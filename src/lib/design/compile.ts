/**
 * Компилятор конфига в CSS и нормализация конфига, пришедшего от клиента.
 *
 * Всё, что попадает в таблицу стилей, проходит два фильтра: идентификатор
 * элемента должен быть в реестре, а значение — пройти валидацию своего типа.
 * Никаких пользовательских селекторов и никакого JS.
 */

import {
  APPEAR_PROPS,
  PROPERTY_BY_KEY,
  TRANSITION_PROPERTY_MAP,
  isValidValue,
  type PropertyDef,
} from "./properties";
import { allowedElementIds, allowedTextIds, selectorForElement, SHARED_KEY, THEME_TOKENS } from "./registry";
import {
  BREAKPOINTS,
  CURRENT_SCHEMA_VERSION,
  SLOTS,
  STATES,
  THEME_MODES,
  canContain,
  emptyConfig,
  mediaQueryFor,
  type Breakpoint,
  type BlockType,
  type DesignBlock,
  type ElementValues,
  type PageConfig,
  type SlotKey,
  type StateKey,
  type ThemeMode,
} from "./types";

const TOKEN_KEYS = new Set(THEME_TOKENS.map((t) => t.key));

const BLOCK_TYPES: BlockType[] = [
  "container",
  "section",
  "grid",
  "heading",
  "text",
  "image",
  "button",
  "divider",
  "spacer",
];

/** Адрес медиафайла: собирается только здесь, из проверенного идентификатора. */
export function mediaUrl(id: string): string {
  return `/api/design/media/${id}/file`;
}

/** Максимальная глубина вложенности блоков — защита от бесконечной структуры. */
const MAX_BLOCK_DEPTH = 4;
const MAX_BLOCKS_PER_SLOT = 40;

/** Допустимая ссылка для кнопки: внутренний маршрут или https-адрес. */
export function isSafeHref(raw: string): boolean {
  const value = raw.trim();
  if (value === "") return true;
  if (value.startsWith("/") && !value.startsWith("//")) return true;
  return /^https:\/\/[a-z0-9.-]+(\/[^\s<>"']*)?$/i.test(value);
}

function sanitizeText(raw: unknown, max = 400): string | undefined {
  if (typeof raw !== "string") return undefined;
  // Текст выводится через React (без dangerouslySetInnerHTML), но угловые
  // скобки убираем, чтобы в подписях нельзя было спрятать разметку.
  const value = raw.replace(/[<>]/g, "").slice(0, max);
  return value === "" ? undefined : value;
}

function normalizeBlocks(raw: unknown, depth: number, seen: Set<string>): DesignBlock[] {
  if (!Array.isArray(raw) || depth > MAX_BLOCK_DEPTH) return [];
  const result: DesignBlock[] = [];

  for (const entry of raw) {
    if (typeof entry !== "object" || entry === null) continue;
    const input = entry as Partial<DesignBlock>;
    const type = input.type;
    if (typeof type !== "string" || !BLOCK_TYPES.includes(type as BlockType)) continue;

    // Важен состав символов (id попадает в CSS-селектор), а не длина —
    // уникальность проверяется отдельно, ниже.
    const id = typeof input.id === "string" && /^[a-zA-Z0-9_-]{1,40}$/.test(input.id) ? input.id : null;
    // Идентификатор обязателен и уникален: на нём держатся настройки блока.
    if (!id || seen.has(id)) continue;
    seen.add(id);

    const block: DesignBlock = { id, type: type as BlockType };

    const name = sanitizeText(input.name, 60);
    if (name) block.name = name;

    const text = sanitizeText(input.text, 2000);
    if (text) block.text = text;

    if (typeof input.href === "string" && isSafeHref(input.href)) {
      const href = input.href.trim();
      if (href) block.href = href;
    }

    if (typeof input.mediaId === "string" && /^[a-z0-9]{20,40}$/i.test(input.mediaId)) {
      block.mediaId = input.mediaId;
    }

    const alt = sanitizeText(input.alt, 200);
    if (alt) block.alt = alt;

    if (Array.isArray(input.hiddenOn)) {
      const valid = input.hiddenOn.filter((b): b is Breakpoint => BREAKPOINTS.some((x) => x.key === b));
      if (valid.length > 0) block.hiddenOn = [...new Set(valid)];
    }
    if (input.hidden === true) block.hidden = true;
    if (input.locked === true) block.locked = true;

    if (canContain(block.type)) {
      const children = normalizeBlocks(input.children, depth + 1, seen);
      if (children.length > 0) block.children = children;
    }

    result.push(block);
    if (result.length >= MAX_BLOCKS_PER_SLOT) break;
  }

  return result;
}

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

  // Блоки объявляют собственные идентификаторы элементов: настройки блока
  // хранятся там же, где настройки размеченных элементов.
  const blocks: Partial<Record<SlotKey, DesignBlock[]>> = {};
  const seenBlockIds = new Set<string>();
  for (const slot of SLOTS) {
    blocks[slot.key] = normalizeBlocks(input.blocks?.[slot.key], 0, seenBlockIds);
  }
  result.blocks = blocks;
  for (const id of seenBlockIds) allowed.add(blockElementId(id));

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
          // Состояние имеет смысл не для всех свойств.
          if (state.key !== "normal" && !def.stateful) continue;

          cleanValues[propKey] ??= {};
          cleanValues[propKey][bp.key] ??= {};
          cleanValues[propKey][bp.key]![state.key] = trimmed;
        }
      }
    }
    if (Object.keys(cleanValues).length > 0) result.elements[elementId] = cleanValues;
  }

  // Статические подписи.
  const textIds = allowedTextIds(pageKey);
  const texts: Record<string, string> = {};
  for (const [id, value] of Object.entries(input.texts ?? {})) {
    if (!textIds.has(id)) continue;
    const clean = sanitizeText(value, 600);
    if (clean) texts[id] = clean;
  }
  result.texts = texts;

  // Блокировки.
  const locks = Array.isArray(input.locks)
    ? input.locks.filter((id): id is string => typeof id === "string" && allowed.has(id))
    : [];
  result.locks = [...new Set(locks)];

  if (pageKey === SHARED_KEY) {
    const tokens: Partial<Record<ThemeMode, Record<string, string>>> = {};
    for (const mode of THEME_MODES) {
      const byMode: Record<string, string> = {};
      for (const [key, value] of Object.entries(input.tokens?.[mode.key] ?? {})) {
        if (!TOKEN_KEYS.has(key) || typeof value !== "string") continue;
        const trimmed = value.trim();
        if (trimmed === "" || !isValidValue(colorDef(key), trimmed)) continue;
        byMode[key] = trimmed;
      }
      tokens[mode.key] = byMode;
    }
    result.tokens = tokens;
  } else {
    result.tokens = { dark: {}, light: {} };
  }

  result.schemaVersion = CURRENT_SCHEMA_VERSION;
  return result;
}

function colorDef(key: string): PropertyDef {
  return { key, label: key, css: key, kind: "color", group: "colors" };
}

/** Идентификатор элемента оформления для добавленного блока. */
export function blockElementId(blockId: string): string {
  return `block.${blockId}`;
}

/**
 * Селектор элемента берётся из реестра: либо атрибутный, либо фиксированный
 * (кнопки, поля, ячейки таблиц). Пользовательские селекторы невозможны.
 */
function attrSelector(elementId: string): string {
  return selectorForElement(elementId);
}

type Rule = { selector: string; decls: string[] };

/** Собирает объявления одного элемента для конкретного брейкпоинта и состояния. */
function declarationsFor(values: ElementValues, bp: Breakpoint, state: StateKey): string[] {
  const decls: string[] = [];
  let appearName = "";
  let appearDuration = "";
  let appearDelay = "";

  for (const [propKey, byBp] of Object.entries(values)) {
    const def = PROPERTY_BY_KEY.get(propKey);
    if (!def) continue;
    if (state !== "normal" && !def.stateful) continue;

    const value = byBp?.[bp]?.[state];
    if (typeof value !== "string" || value === "" || !isValidValue(def, value)) continue;

    if (APPEAR_PROPS.has(propKey)) {
      if (propKey === "appearAnimation") appearName = value;
      if (propKey === "appearDuration") appearDuration = value;
      if (propKey === "appearDelay") appearDelay = value;
      continue;
    }

    if (def.kind === "media") {
      decls.push(`${def.css}: url(${mediaUrl(value)})`);
      continue;
    }
    if (propKey === "transitionProperty") {
      decls.push(`${def.css}: ${TRANSITION_PROPERTY_MAP[value] ?? "all"}`);
      continue;
    }
    decls.push(`${def.css}: ${value}`);
  }

  // Появление собираем отдельно: нужны имя, длительность и режим заполнения,
  // иначе элемент мигнёт в исходном состоянии до старта анимации.
  if (appearName && appearName !== "none") {
    decls.push(`animation-name: ${appearName}`);
    decls.push(`animation-duration: ${appearDuration || "400ms"}`);
    decls.push(`animation-delay: ${appearDelay || "0ms"}`);
    decls.push("animation-fill-mode: both");
    decls.push("animation-timing-function: ease-out");
  }

  return decls;
}

/** Есть ли у элемента настройки появления — такие правила уходят под prefers-reduced-motion. */
function hasAppear(values: ElementValues, bp: Breakpoint): boolean {
  const name = values.appearAnimation?.[bp]?.normal;
  return typeof name === "string" && name !== "" && name !== "none";
}

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

  const byBreakpoint = new Map<Breakpoint, Rule[]>();
  const motionByBreakpoint = new Map<Breakpoint, Rule[]>();

  for (const [elementId, values] of Object.entries(config.elements)) {
    const base = attrSelector(elementId);
    if (!base) continue;

    for (const bp of BREAKPOINTS) {
      for (const state of STATES) {
        const decls = declarationsFor(values, bp.key, state.key);
        if (decls.length === 0) continue;

        const selector = `${scope}${base}${state.suffix}`;
        const appear = state.key === "normal" && hasAppear(values, bp.key);

        // Правила с появлением кладём в отдельный блок: он обёрнут в
        // prefers-reduced-motion, чтобы уважать системную настройку.
        const animationDecls = decls.filter((d) => d.startsWith("animation-"));
        const plainDecls = decls.filter((d) => !d.startsWith("animation-"));

        if (plainDecls.length > 0) {
          const list = byBreakpoint.get(bp.key) ?? [];
          list.push({ selector, decls: plainDecls });
          byBreakpoint.set(bp.key, list);
        }
        if (appear && animationDecls.length > 0) {
          const list = motionByBreakpoint.get(bp.key) ?? [];
          list.push({ selector, decls: animationDecls });
          motionByBreakpoint.set(bp.key, list);
        }
      }
    }
  }

  const chunks: string[] = [];

  // Токены темы пишем первыми — их переопределяют любые точечные правила.
  if (pageKey === SHARED_KEY) {
    for (const mode of THEME_MODES) {
      const entries = Object.entries(config.tokens?.[mode.key] ?? {}).filter(([key]) => TOKEN_KEYS.has(key));
      if (entries.length === 0) continue;
      const decls = entries.map(([key, value]) => `--${key}: ${value}`).join(";");
      // Тёмная — тема по умолчанию (:root), светлая включается атрибутом.
      const selector = mode.key === "dark" ? ":root" : ':root[data-theme="light"]';
      chunks.push(`${selector}{${decls}}`);
    }
  }

  for (const bp of BREAKPOINTS) {
    const rules = byBreakpoint.get(bp.key);
    if (!rules || rules.length === 0) continue;
    const body = rules.map((r) => `${r.selector}{${r.decls.join(";")}}`).join("");
    const media = mediaQueryFor(bp.key);
    chunks.push(media ? `${media}{${body}}` : body);
  }

  for (const bp of BREAKPOINTS) {
    const rules = motionByBreakpoint.get(bp.key);
    if (!rules || rules.length === 0) continue;
    const body = rules.map((r) => `${r.selector}{${r.decls.join(";")}}`).join("");
    const media = mediaQueryFor(bp.key);
    const inner = media ? `${media}{${body}}` : body;
    chunks.push(`@media (prefers-reduced-motion: no-preference){${inner}}`);
  }

  return chunks.join("");
}

function cssSafeKey(key: string): string {
  return /^[a-zA-Z0-9_-]+$/.test(key) ? key : "";
}

/** Сколько свойств реально задано — для отметки «есть изменения». */
export function countSetProperties(config: PageConfig): number {
  let total = 0;
  for (const mode of THEME_MODES) total += Object.keys(config.tokens?.[mode.key] ?? {}).length;
  total += Object.keys(config.texts ?? {}).length;
  for (const slot of SLOTS) total += (config.blocks?.[slot.key] ?? []).length;
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
