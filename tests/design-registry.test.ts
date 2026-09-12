import test from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";

import { PAGES, SHARED_ELEMENTS, SHARED_TEXTS, selectorForElement } from "../src/lib/design/registry";

/**
 * Реестр не должен обещать больше, чем есть в коде: настройка, которой нет
 * соответствия в разметке, выглядит рабочей, но ни на что не влияет.
 * Поэтому ищем каждый идентификатор в исходниках.
 */
function grepSources(needle: string): boolean {
  try {
    execFileSync("git", ["grep", "-q", "--fixed-strings", needle, "--", "src"], { stdio: "pipe" });
    return true;
  } catch {
    return false;
  }
}

test("каждая объявленная подпись используется в коде", () => {
  const all = [...SHARED_TEXTS, ...PAGES.flatMap((p) => p.texts ?? [])];
  assert.ok(all.length > 0, "подписи должны быть объявлены");
  const missing = all.filter((t) => !grepSources(t.id)).map((t) => t.id);
  assert.deepEqual(missing, [], `подписи объявлены, но не подключены: ${missing.join(", ")}`);
});

test("каждый атрибутный элемент размечен в разметке", () => {
  const attrElements = [...SHARED_ELEMENTS, ...PAGES.flatMap((p) => p.elements)].filter((e) => !e.selector);
  assert.ok(attrElements.length > 0);

  // Идентификатор попадает в разметку тремя путями: литеральным атрибутом,
  // пропсом designId="..." или значением по умолчанию внутри выражения
  // (так размечена общая панель: data-design-el={designId ?? "shared.panel"}).
  // Поэтому достаточно найти его как строковый литерал: это отлавливает
  // реальную ошибку — объявленный в реестре и нигде не использованный id.
  const missing = attrElements.filter((e) => !grepSources(`"${e.id}"`)).map((e) => e.id);
  assert.deepEqual(missing, [], `элементы объявлены, но не использованы в коде: ${missing.join(", ")}`);
});

test("селектор элемента строится только из безопасных символов", () => {
  for (const el of [...SHARED_ELEMENTS, ...PAGES.flatMap((p) => p.elements)]) {
    const selector = selectorForElement(el.id);
    assert.notEqual(selector, "", `у ${el.id} пустой селектор`);
    assert.doesNotMatch(selector, /[;{}]/, `селектор ${el.id} может закрыть правило`);
  }
});

test("ключи страниц уникальны и пригодны для CSS", () => {
  const keys = PAGES.map((p) => p.key);
  assert.equal(new Set(keys).size, keys.length, "ключи страниц должны быть уникальны");
  for (const key of keys) assert.match(key, /^[a-zA-Z0-9_-]+$/, `ключ ${key} нельзя подставить в селектор`);
});

test("идентификаторы элементов уникальны", () => {
  const ids = [...SHARED_ELEMENTS, ...PAGES.flatMap((p) => p.elements)].map((e) => e.id);
  const dupes = ids.filter((id, i) => ids.indexOf(id) !== i);
  assert.deepEqual([...new Set(dupes)], [], "идентификаторы элементов должны быть уникальны");
});
