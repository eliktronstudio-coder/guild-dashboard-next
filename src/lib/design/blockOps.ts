/**
 * Операции над деревом добавленных блоков: вынести, вставить, переместить.
 *
 * Работают сразу по обоим слотам страницы, поэтому блок можно перетащить из
 * «над содержимым» в «под содержимым». Все функции чистые — возвращают новое
 * дерево, что и позволяет держать историю отмены снимками.
 */

import { SLOTS, canContain, type DesignBlock, type SlotKey } from "./types";

export type BlocksState = Partial<Record<SlotKey, DesignBlock[]>>;
export type DropPosition = "before" | "after" | "inside";

function removeFromList(list: DesignBlock[], id: string): { list: DesignBlock[]; removed: DesignBlock | null } {
  let removed: DesignBlock | null = null;
  const next: DesignBlock[] = [];

  for (const item of list) {
    if (item.id === id) {
      removed = item;
      continue;
    }
    if (item.children?.length) {
      const inner = removeFromList(item.children, id);
      if (inner.removed) {
        removed = inner.removed;
        next.push({ ...item, children: inner.list.length > 0 ? inner.list : undefined });
        continue;
      }
    }
    next.push(item);
  }

  return { list: next, removed };
}

/** Вынимает блок из состояния. */
export function extractBlock(state: BlocksState, id: string): { state: BlocksState; block: DesignBlock | null } {
  const next: BlocksState = {};
  let block: DesignBlock | null = null;
  for (const slot of SLOTS) {
    const result = removeFromList(state[slot.key] ?? [], id);
    next[slot.key] = result.list;
    if (result.removed) block = result.removed;
  }
  return { state: next, block };
}

function insertIntoList(
  list: DesignBlock[],
  targetId: string,
  position: DropPosition,
  block: DesignBlock
): { list: DesignBlock[]; done: boolean } {
  const next: DesignBlock[] = [];
  let done = false;

  for (const item of list) {
    if (item.id === targetId) {
      if (position === "before") {
        next.push(block, item);
        done = true;
        continue;
      }
      if (position === "after") {
        next.push(item, block);
        done = true;
        continue;
      }
      // inside: только для контейнеров, иначе получилась бы структура,
      // которую рендер не поддерживает.
      if (canContain(item.type)) {
        next.push({ ...item, children: [...(item.children ?? []), block] });
        done = true;
        continue;
      }
      next.push(item, block);
      done = true;
      continue;
    }

    if (!done && item.children?.length) {
      const inner = insertIntoList(item.children, targetId, position, block);
      if (inner.done) {
        next.push({ ...item, children: inner.list });
        done = true;
        continue;
      }
    }
    next.push(item);
  }

  return { list: next, done };
}

/** Вставляет блок относительно целевого. */
export function insertBlock(
  state: BlocksState,
  targetId: string,
  position: DropPosition,
  block: DesignBlock
): BlocksState {
  const next: BlocksState = {};
  let done = false;
  for (const slot of SLOTS) {
    if (done) {
      next[slot.key] = state[slot.key] ?? [];
      continue;
    }
    const result = insertIntoList(state[slot.key] ?? [], targetId, position, block);
    next[slot.key] = result.list;
    done = result.done;
  }
  return next;
}

/** Добавляет блок в конец слота. */
export function appendToSlot(state: BlocksState, slot: SlotKey, block: DesignBlock): BlocksState {
  return { ...state, [slot]: [...(state[slot] ?? []), block] };
}

/** Содержит ли блок указанный id среди потомков (защита от переноса в себя). */
export function containsId(block: DesignBlock, id: string): boolean {
  if (block.id === id) return true;
  return (block.children ?? []).some((child) => containsId(child, id));
}

/**
 * Перемещает блок. Возвращает прежнее состояние, если перенос невозможен:
 * блок нельзя вложить в самого себя или в собственного потомка.
 */
export function moveBlock(
  state: BlocksState,
  draggedId: string,
  targetId: string,
  position: DropPosition
): BlocksState {
  if (draggedId === targetId) return state;

  const found = findBlock(state, draggedId);
  if (found && containsId(found, targetId)) return state;

  const extracted = extractBlock(state, draggedId);
  if (!extracted.block) return state;
  return insertBlock(extracted.state, targetId, position, extracted.block);
}

export function findBlock(state: BlocksState, id: string): DesignBlock | null {
  for (const slot of SLOTS) {
    const found = findInList(state[slot.key] ?? [], id);
    if (found) return found;
  }
  return null;
}

function findInList(list: DesignBlock[], id: string): DesignBlock | null {
  for (const item of list) {
    if (item.id === id) return item;
    if (item.children?.length) {
      const found = findInList(item.children, id);
      if (found) return found;
    }
  }
  return null;
}

export function findSlotOf(state: BlocksState, id: string): SlotKey | null {
  for (const slot of SLOTS) {
    if (findInList(state[slot.key] ?? [], id)) return slot.key;
  }
  return null;
}

/** Заменяет поля блока по id. */
export function patchBlock(state: BlocksState, id: string, changes: Partial<DesignBlock>): BlocksState {
  const next: BlocksState = {};
  for (const slot of SLOTS) next[slot.key] = patchList(state[slot.key] ?? [], id, changes);
  return next;
}

function patchList(list: DesignBlock[], id: string, changes: Partial<DesignBlock>): DesignBlock[] {
  return list.map((item) => {
    if (item.id === id) return { ...item, ...changes };
    if (item.children?.length) return { ...item, children: patchList(item.children, id, changes) };
    return item;
  });
}
