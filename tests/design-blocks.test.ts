import test from "node:test";
import assert from "node:assert/strict";

import {
  appendToSlot,
  containsId,
  extractBlock,
  findBlock,
  findSlotOf,
  insertBlock,
  moveBlock,
  patchBlock,
  type BlocksState,
} from "../src/lib/design/blockOps";
import { instantiateSnippet, normalizeSnippet } from "../src/lib/design/snippets";
import type { DesignBlock } from "../src/lib/design/types";

function block(id: string, type: DesignBlock["type"] = "text", children?: DesignBlock[]): DesignBlock {
  return children ? { id, type, children } : { id, type };
}

function state(): BlocksState {
  return {
    top: [block("a", "section", [block("a1"), block("a2")]), block("b")],
    bottom: [block("c")],
  };
}

test("блок вынимается из любой глубины", () => {
  const result = extractBlock(state(), "a1");
  assert.equal(result.block?.id, "a1");
  assert.equal(findBlock(result.state, "a1"), null);
  // Соседний потомок остаётся на месте.
  assert.equal(findBlock(result.state, "a2")?.id, "a2");
});

test("вставка до и после цели", () => {
  const before = insertBlock(state(), "b", "before", block("new"));
  assert.deepEqual(before.top?.map((b) => b.id), ["a", "new", "b"]);

  const after = insertBlock(state(), "b", "after", block("new"));
  assert.deepEqual(after.top?.map((b) => b.id), ["a", "b", "new"]);
});

test("вставка внутрь работает только для контейнеров", () => {
  const inside = insertBlock(state(), "a", "inside", block("new"));
  assert.deepEqual(findBlock(inside, "a")?.children?.map((b) => b.id), ["a1", "a2", "new"]);

  // «b» — текст, вкладывать в него нельзя: блок должен встать рядом.
  const fallback = insertBlock(state(), "b", "inside", block("new"));
  assert.equal(findBlock(fallback, "b")?.children, undefined);
  assert.deepEqual(fallback.top?.map((b) => b.id), ["a", "b", "new"]);
});

test("перемещение между слотами", () => {
  const moved = moveBlock(state(), "b", "c", "after");
  assert.equal(findSlotOf(moved, "b"), "bottom");
  assert.deepEqual(moved.bottom?.map((x) => x.id), ["c", "b"]);
  assert.deepEqual(moved.top?.map((x) => x.id), ["a"]);
});

test("блок нельзя переместить внутрь самого себя или потомка", () => {
  const original = state();

  const intoSelf = moveBlock(original, "a", "a", "inside");
  assert.deepEqual(intoSelf, original, "перенос в себя должен быть отклонён");

  const intoChild = moveBlock(original, "a", "a1", "inside");
  assert.equal(findBlock(intoChild, "a")?.id, "a", "родитель должен остаться на месте");
  assert.equal(findSlotOf(intoChild, "a"), "top");
  // Структура не должна развалиться: a1 по-прежнему внутри a.
  assert.ok(
    findBlock(intoChild, "a")?.children?.some((c) => c.id === "a1"),
    "потомок должен остаться внутри родителя"
  );
});

test("containsId видит потомков на любой глубине", () => {
  const tree = block("root", "container", [block("mid", "container", [block("leaf")])]);
  assert.equal(containsId(tree, "leaf"), true);
  assert.equal(containsId(tree, "нет"), false);
});

test("appendToSlot и patchBlock не задевают соседние слоты", () => {
  const added = appendToSlot(state(), "bottom", block("z"));
  assert.deepEqual(added.bottom?.map((b) => b.id), ["c", "z"]);
  assert.deepEqual(added.top?.map((b) => b.id), ["a", "b"]);

  const patched = patchBlock(state(), "a1", { name: "Переименован" });
  assert.equal(findBlock(patched, "a1")?.name, "Переименован");
  assert.equal(findBlock(patched, "a2")?.name, undefined);
});

test("заготовка нормализуется и отбрасывает чужое оформление", () => {
  const payload = normalizeSnippet({
    block: block("s1", "section", [block("s2", "heading")]),
    styles: {
      "block.s1": { padding: { base: { normal: "16px" } } },
      "block.s2": { color: { base: { normal: "#fff" } } },
      // Элемента с таким id в дереве нет — оформление должно отсеяться.
      "block.нет": { color: { base: { normal: "#000" } } },
      "home.myChart": { color: { base: { normal: "#000" } } },
    },
  });
  assert.ok(payload);
  assert.deepEqual(Object.keys(payload!.styles).sort(), ["block.s1", "block.s2"]);
});

test("заготовка без валидного блока не сохраняется", () => {
  assert.equal(normalizeSnippet({ block: { id: "x", type: "чужой" }, styles: {} }), null);
  assert.equal(normalizeSnippet(null), null);
  assert.equal(normalizeSnippet("не json"), null);
});

test("вставка заготовки выдаёт новые id и переносит на них оформление", () => {
  const payload = normalizeSnippet({
    block: block("s1", "section", [block("s2", "heading")]),
    styles: {
      "block.s1": { padding: { base: { normal: "16px" } } },
      "block.s2": { color: { base: { normal: "#ffffff" } } },
    },
  });
  assert.ok(payload);

  const first = instantiateSnippet(payload!);
  const second = instantiateSnippet(payload!);

  // Две вставки одной заготовки не должны делить идентификаторы, иначе
  // правка оформления на одной странице меняла бы вторую.
  assert.notEqual(first.block.id, second.block.id);
  assert.notEqual(first.block.children?.[0].id, second.block.children?.[0].id);
  assert.notEqual(first.block.id, "s1");

  // Оформление переехало на новые ключи и сохранило значения.
  assert.equal(first.styles[`block.${first.block.id}`]?.padding?.base?.normal, "16px");
  assert.equal(
    first.styles[`block.${first.block.children![0].id}`]?.color?.base?.normal,
    "#ffffff"
  );
  assert.equal(first.styles["block.s1"], undefined, "старые ключи не должны остаться");
});
