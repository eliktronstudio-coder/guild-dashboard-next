/**
 * Сохранённые блоки для повторного использования.
 *
 * Заготовка — это одно дерево блоков плюс оформление его элементов. При
 * вставке идентификаторы пересоздаются: иначе одна заготовка, положенная на
 * две страницы, делила бы с ними один id, и правка оформления на одной
 * странице меняла бы вторую.
 */

import { normalizeBlockTree, normalizeElementValues } from "./normalize";
import { blockElementId } from "./compile";
import { walkBlocks, type DesignBlock, type ElementValues } from "./types";

export type SnippetPayload = {
  block: DesignBlock;
  /** Оформление элементов заготовки: ключи — block.<id> внутри дерева. */
  styles: Record<string, ElementValues>;
};

/** Приводит сохранённое к валидному виду; null — сохранять нечего. */
export function normalizeSnippet(raw: unknown): SnippetPayload | null {
  let input: unknown = raw;
  if (typeof raw === "string") {
    try {
      input = JSON.parse(raw);
    } catch {
      return null;
    }
  }
  if (typeof input !== "object" || input === null) return null;

  const candidate = input as Partial<SnippetPayload>;
  const tree = normalizeBlockTree(candidate.block ? [candidate.block] : [], 0, new Set());
  if (tree.length === 0) return null;
  const block = tree[0];

  // Оставляем оформление только тех элементов, что реально есть в дереве.
  const known = new Set<string>();
  walkBlocks([block], (b) => known.add(blockElementId(b.id)));

  const styles: Record<string, ElementValues> = {};
  for (const [key, values] of Object.entries(candidate.styles ?? {})) {
    if (!known.has(key)) continue;
    const clean = normalizeElementValues(values);
    if (Object.keys(clean).length > 0) styles[key] = clean;
  }

  return { block, styles };
}

function freshId() {
  return `b${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
}

/**
 * Готовит заготовку к вставке: новые идентификаторы и перенесённое на них
 * оформление. Возвращает блок и его стили под новыми ключами.
 */
export function instantiateSnippet(payload: SnippetPayload): {
  block: DesignBlock;
  styles: Record<string, ElementValues>;
} {
  const idMap = new Map<string, string>();

  function rebuild(block: DesignBlock): DesignBlock {
    const id = freshId();
    idMap.set(block.id, id);
    return {
      ...block,
      id,
      children: block.children?.map(rebuild),
    };
  }

  const block = rebuild(payload.block);

  const styles: Record<string, ElementValues> = {};
  for (const [oldKey, values] of Object.entries(payload.styles)) {
    const oldId = oldKey.replace(/^block\./, "");
    const newId = idMap.get(oldId);
    if (!newId) continue;
    styles[blockElementId(newId)] = values;
  }

  return { block, styles };
}
