/**
 * Примитивы нормализации, общие для компилятора и сохранённых блоков.
 *
 * Вынесены в отдельный модуль, чтобы snippets.ts и compile.ts могли
 * пользоваться ими без взаимных импортов.
 */

import { PROPERTY_BY_KEY, isValidValue } from "./properties";
import { BREAKPOINTS, STATES, canContain, type BlockType, type DesignBlock, type ElementValues } from "./types";

export const MAX_BLOCK_DEPTH = 4;
export const MAX_BLOCKS_PER_SLOT = 40;

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

/** Идентификатор элемента оформления для добавленного блока. */
export function blockElementId(blockId: string): string {
  return `block.${blockId}`;
}

/** Допустимая ссылка для кнопки: внутренний маршрут или https-адрес. */
export function isSafeHref(raw: string): boolean {
  const value = raw.trim();
  if (value === "") return true;
  if (value.startsWith("/") && !value.startsWith("//")) return true;
  return /^https:\/\/[a-z0-9.-]+(\/[^\s<>"']*)?$/i.test(value);
}

export function sanitizeText(raw: unknown, max = 400): string | undefined {
  if (typeof raw !== "string") return undefined;
  // Текст выводится через React (без dangerouslySetInnerHTML), но угловые
  // скобки убираем, чтобы в подписях нельзя было спрятать разметку.
  const value = raw.replace(/[<>]/g, "").slice(0, max);
  return value === "" ? undefined : value;
}

/** Оставляет только известные свойства с валидными значениями. */
export function normalizeElementValues(raw: unknown): ElementValues {
  const clean: ElementValues = {};
  if (typeof raw !== "object" || raw === null) return clean;

  for (const [propKey, byBp] of Object.entries(raw as ElementValues)) {
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
        if (state.key !== "normal" && !def.stateful) continue;

        clean[propKey] ??= {};
        clean[propKey][bp.key] ??= {};
        clean[propKey][bp.key]![state.key] = trimmed;
      }
    }
  }
  return clean;
}

/** Приводит дерево блоков к валидному виду. */
export function normalizeBlockTree(raw: unknown, depth: number, seen: Set<string>): DesignBlock[] {
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
      const valid = input.hiddenOn.filter((b) => BREAKPOINTS.some((x) => x.key === b));
      if (valid.length > 0) block.hiddenOn = [...new Set(valid)];
    }
    if (input.hidden === true) block.hidden = true;
    if (input.locked === true) block.locked = true;

    if (canContain(block.type)) {
      const children = normalizeBlockTree(input.children, depth + 1, seen);
      if (children.length > 0) block.children = children;
    }

    result.push(block);
    if (result.length >= MAX_BLOCKS_PER_SLOT) break;
  }

  return result;
}
