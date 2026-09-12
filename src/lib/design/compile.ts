/**
 * Компилятор конфига в CSS и нормализация конфига, пришедшего от клиента.
 *
 * Всё, что попадает в таблицу стилей, проходит два фильтра: идентификатор
 * элемента должен быть в реестре, а значение — пройти валидацию своего типа.
 * Никаких пользовательских селекторов и никакого JS.
 */

import { PROPERTY_BY_KEY, isValidValue } from "./properties";
import { allowedElementIds, SHARED_KEY, THEME_TOKENS } from "./registry";
import {
  BREAKPOINTS,
  CURRENT_SCHEMA_VERSION,
  STATES,
  emptyConfig,
  mediaQueryFor,
  type Breakpoint,
  type ElementValues,
  type PageConfig,
  type StateKey,
} from "./types";

const TOKEN_KEYS = new Set(THEME_TOKENS.map((t) => t.key));

/**
 * Приводит произвольный JSON к валидному конфигу: выбрасывает неизвестные
 * элементы, свойства и значения. Используется и при чтении из БД, и при
 * записи — старые сохранённые конфиги переживают изменение реестра.
 */
export function normalizeConfig(raw: unknown, pageKey: string): PageConfig {
  const allowed = allowedElementIds(pageKey);
  const result = emptyConfig();
  if (typeof raw !== "object" || raw === null) return result;

  const input = raw as Partial<PageConfig>;

  for (const [elementId, values] of Object.entries(input.elements ?? {})) {
    if (!allowed.has(elementId) || typeof values !== "object" || values === null) continue;
    const cleanValues: ElementValues = {};

    for (const [propKey, byBp] of Object.entries(values as ElementValues)) {
      const def = PROPERTY_BY_KEY.get(propKey);
      if (!def || typeof byBp !== "object" || byBp === null) continue;

      for (const bp of BREAKPOINTS) {
        const byState = byBp[bp.key];
        if (typeof byState !== "object" || byState === null) continue;

        for (const state of STATES) {
          const value = byState[state.key];
          if (typeof value !== "string") continue;
          const trimmed = value.trim();
          if (trimmed === "" || !isValidValue(def, trimmed)) continue;
          // Состояние наведения имеет смысл не для всех свойств.
          if (state.key !== "normal" && !def.stateful) continue;

          cleanValues[propKey] ??= {};
          cleanValues[propKey][bp.key] ??= {};
          cleanValues[propKey][bp.key]![state.key] = trimmed;
        }
      }
    }
    if (Object.keys(cleanValues).length > 0) result.elements[elementId] = cleanValues;
  }

  if (pageKey === SHARED_KEY) {
    const tokens: Record<string, string> = {};
    for (const [key, value] of Object.entries(input.tokens ?? {})) {
      if (!TOKEN_KEYS.has(key) || typeof value !== "string") continue;
      const trimmed = value.trim();
      // Токены — цвета; переиспользуем валидатор цвета.
      if (trimmed === "" || !isValidValue({ key, label: key, css: key, kind: "color", group: "colors" }, trimmed)) {
        continue;
      }
      tokens[key] = trimmed;
    }
    result.tokens = tokens;
  }

  result.schemaVersion = CURRENT_SCHEMA_VERSION;
  return result;
}

/** Экранирует значение атрибута для использования в селекторе. */
function attrSelector(elementId: string): string {
  // В id допустимы только буквы, цифры и точка — проверено реестром, но
  // подстрахуемся: любой посторонний символ делает селектор невалидным.
  if (!/^[a-zA-Z0-9.]+$/.test(elementId)) return "";
  return `[data-design-el="${elementId}"]`;
}

type Rule = { selector: string; decls: string[] };

/**
 * Собирает CSS одного конфига.
 *
 * scope:
 *  - для общих настроек пусто — правила действуют везде;
 *  - для страницы это [data-design-page="<key>"], что и даёт изоляцию:
 *    правило страницы не может примениться на другой странице, а при
 *    совпадении элемента побеждает над общим за счёт большей специфичности.
 */
export function compileConfig(config: PageConfig, pageKey: string): string {
  const scope = pageKey === SHARED_KEY ? "" : `[data-design-page="${cssSafeKey(pageKey)}"] `;
  if (pageKey !== SHARED_KEY && scope.trim() === "") return "";

  // Группируем по «брейкпоинт -> правила», чтобы медиазапрос писался один раз.
  const byBreakpoint = new Map<Breakpoint, Rule[]>();

  for (const [elementId, values] of Object.entries(config.elements)) {
    const base = attrSelector(elementId);
    if (!base) continue;

    for (const bp of BREAKPOINTS) {
      for (const state of STATES) {
        const decls: string[] = [];

        for (const [propKey, byBp] of Object.entries(values)) {
          const def = PROPERTY_BY_KEY.get(propKey);
          if (!def) continue;
          if (state.key !== "normal" && !def.stateful) continue;

          const value = byBp?.[bp.key]?.[state.key];
          if (typeof value !== "string" || value === "" || !isValidValue(def, value)) continue;
          decls.push(`${def.css}: ${value}`);
        }

        if (decls.length === 0) continue;
        const selector = `${scope}${base}${state.suffix}`;
        const list = byBreakpoint.get(bp.key) ?? [];
        list.push({ selector, decls });
        byBreakpoint.set(bp.key, list);
      }
    }
  }

  const chunks: string[] = [];

  // Токены темы пишем первыми — их переопределяют любые точечные правила.
  const tokens = pageKey === SHARED_KEY ? config.tokens ?? {} : {};
  const tokenDecls = Object.entries(tokens)
    .filter(([key]) => TOKEN_KEYS.has(key))
    .map(([key, value]) => `--${key}: ${value}`);
  if (tokenDecls.length > 0) chunks.push(`:root{${tokenDecls.join(";")}}`);

  for (const bp of BREAKPOINTS) {
    const rules = byBreakpoint.get(bp.key);
    if (!rules || rules.length === 0) continue;
    const body = rules.map((r) => `${r.selector}{${r.decls.join(";")}}`).join("");
    const media = mediaQueryFor(bp.key);
    chunks.push(media ? `${media}{${body}}` : body);
  }

  return chunks.join("");
}

function cssSafeKey(key: string): string {
  return /^[a-zA-Z0-9_-]+$/.test(key) ? key : "";
}

/** Сколько свойств реально задано — для отметки «есть изменения». */
export function countSetProperties(config: PageConfig): number {
  let total = Object.keys(config.tokens ?? {}).length;
  for (const values of Object.values(config.elements)) {
    for (const byBp of Object.values(values)) {
      for (const byState of Object.values(byBp ?? {})) {
        total += Object.values(byState ?? {}).filter((v) => typeof v === "string" && v !== "").length;
      }
    }
  }
  return total;
}

/** Строгое сравнение двух конфигов — используется для «есть неопубликованные изменения». */
export function configsEqual(a: PageConfig, b: PageConfig): boolean {
  return stableStringify(a) === stableStringify(b);
}

export function stableStringify(value: unknown): string {
  if (value === null || typeof value !== "object") return JSON.stringify(value) ?? "null";
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(",")}]`;
  const entries = Object.entries(value as Record<string, unknown>)
    .filter(([, v]) => v !== undefined)
    .sort(([a], [b]) => a.localeCompare(b));
  return `{${entries.map(([k, v]) => `${JSON.stringify(k)}:${stableStringify(v)}`).join(",")}}`;
}

export function parseConfig(json: string, pageKey: string): PageConfig {
  try {
    return normalizeConfig(JSON.parse(json), pageKey);
  } catch {
    return emptyConfig();
  }
}
