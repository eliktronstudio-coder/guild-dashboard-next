import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

import { ACHIEVEMENTS } from "../src/lib/achievements/catalog";

/**
 * Иконки лежат в клиентском компоненте, поэтому читаем файл, а не импортируем:
 * tsx-тест не должен тащить сюда React ради проверки списка ключей.
 */
const source = readFileSync("src/components/achievements/AchievementIcon.tsx", "utf8");

/** Ключи вида "crossed-swords": из объекта PATHS. */
const declared = new Set([...source.matchAll(/^ {2}"?([a-z][a-z0-9-]*)"?:\s*\(/gm)].map((m) => m[1]));

test("у каждой из 30 цепочек есть своя иконка", () => {
  const missing = ACHIEVEMENTS.filter((a) => !declared.has(a.icon)).map((a) => `${a.key} → ${a.icon}`);
  assert.deepEqual(missing, [], "иконка без рисунка молча покажет заглушку");
});

test("лишних иконок не осталось", () => {
  const used = new Set(ACHIEVEMENTS.map((a) => a.icon));
  const extra = [...declared].filter((k) => !used.has(k));
  assert.deepEqual(extra, [], "неиспользуемые иконки — мёртвый код");
});

test("иконок ровно 30 и все разные", () => {
  assert.equal(declared.size, 30);
});
