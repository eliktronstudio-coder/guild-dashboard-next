import test from "node:test";
import assert from "node:assert/strict";

import {
  DEFAULT_TIERS,
  MAX_POINTS_PER_CHAIN,
  chainProgress,
  newlyEarnedTiers,
} from "../src/lib/achievements/tiers";
import { ACHIEVEMENTS, ACHIEVEMENT_BY_KEY, CATEGORIES, catalogMaxPoints } from "../src/lib/achievements/catalog";

/* ——— Пороги и очки ——— */

test("ступени ровно такие, как в задании", () => {
  assert.deepEqual(
    DEFAULT_TIERS.map((t) => t.threshold),
    [10, 20, 50, 100, 500, 1000],
    "пороги нельзя менять ради баланса"
  );
  assert.deepEqual(DEFAULT_TIERS.map((t) => t.points), [10, 20, 30, 50, 100, 200]);
  assert.deepEqual(
    DEFAULT_TIERS.map((t) => t.rarity),
    ["Обычная", "Необычная", "Редкая", "Эпическая", "Легендарная", "Мифическая"]
  );
  assert.deepEqual(DEFAULT_TIERS.map((t) => t.roman), ["I", "II", "III", "IV", "V", "VI"]);
});

test("максимум за цепочку — 410, за весь каталог — 12 300", () => {
  assert.equal(MAX_POINTS_PER_CHAIN, 410);
  assert.equal(ACHIEVEMENTS.length, 30, "ровно 30 цепочек");
  assert.equal(catalogMaxPoints(MAX_POINTS_PER_CHAIN), 12_300);
});

test("пороги накопительные: с 10 до 20 нужно ещё 10 единиц", () => {
  const atTen = chainProgress(10);
  assert.equal(atTen.level, 1, "первая ступень взята");
  assert.equal(atTen.next!.threshold, 20);
  assert.equal(atTen.remaining, 10, "до второй ступени ещё десять, а не двадцать");

  const atNineteen = chainProgress(19);
  assert.equal(atNineteen.level, 1, "девятнадцати не хватает");
  assert.equal(atNineteen.remaining, 1);

  assert.equal(chainProgress(20).level, 2);
});

test("очки копятся за все взятые ступени", () => {
  assert.equal(chainProgress(0).points, 0);
  assert.equal(chainProgress(10).points, 10);
  assert.equal(chainProgress(20).points, 30, "10 + 20");
  assert.equal(chainProgress(50).points, 60);
  assert.equal(chainProgress(100).points, 110);
  assert.equal(chainProgress(500).points, 210);
  assert.equal(chainProgress(1000).points, 410);
});

test("прыжок через несколько порогов выдаёт все ступени разом", () => {
  const jumped = chainProgress(120);
  assert.equal(jumped.level, 4, "10, 20, 50 и 100 пройдены");
  assert.equal(jumped.points, 110, "очки за все четыре, а не за последнюю");

  // И то же самое при переходе: получено ровно четыре новых ступени.
  const gained = newlyEarnedTiers(0, 120);
  assert.deepEqual(gained.map((t) => t.level), [1, 2, 3, 4]);
});

test("повторный пересчёт не выдаёт ступени второй раз", () => {
  assert.deepEqual(newlyEarnedTiers(120, 120), [], "значение не изменилось — новых ступеней нет");
  assert.deepEqual(newlyEarnedTiers(120, 150), [], "порог не пересечён");
  assert.deepEqual(newlyEarnedTiers(120, 500).map((t) => t.level), [5], "только вновь взятая");
});

test("откат значения не отбирает и не переначисляет ступени", () => {
  // Сброс счётчика или исправление данных не должны давать ложный прогресс
  // при возврате к прежнему значению.
  assert.deepEqual(newlyEarnedTiers(500, 100), [], "падение вниз новых ступеней не даёт");
  assert.deepEqual(newlyEarnedTiers(500, 600), [], "возврат к уже пройденному — тоже");
  assert.deepEqual(newlyEarnedTiers(500, 1000).map((t) => t.level), [6]);
});

test("максимальный уровень: следующей цели нет", () => {
  const max = chainProgress(1000);
  assert.equal(max.maxed, true);
  assert.equal(max.next, null);
  assert.equal(max.remaining, null);
  assert.equal(max.ratio, 1);

  const over = chainProgress(99_999);
  assert.equal(over.level, 6, "выше шестой ступеней нет");
  assert.equal(over.points, 410, "очки не растут сверх максимума");
});

test("полоса показывает закрытие текущей ступени, а не всей цепочки", () => {
  // На 15 из 20: первая ступень взята, во второй закрыто 5 из 10.
  const p = chainProgress(15);
  assert.equal(p.inTier, 5);
  assert.equal(p.tierSize, 10);
  assert.equal(p.ratio, 0.5);

  // На пути с 500 к 1000 полоса тоже двигается, а не стоит почти на нуле.
  const long = chainProgress(750);
  assert.equal(long.inTier, 250);
  assert.equal(long.tierSize, 500);
  assert.equal(long.ratio, 0.5);
});

test("мусорные значения не ломают расчёт", () => {
  for (const bad of [-5, Number.NaN, Number.POSITIVE_INFINITY, -Number.MAX_SAFE_INTEGER]) {
    const p = chainProgress(bad as number);
    assert.ok(p.level >= 0 && p.points >= 0, `значение ${bad} не должно давать отрицательных очков`);
  }
  assert.equal(chainProgress(-5).level, 0);
  assert.equal(chainProgress(Number.NaN).value, 0);
  assert.equal(chainProgress(9.9).level, 0, "дробное округляем вниз");
});

/* ——— Каталог ——— */

test("в каталоге 30 цепочек с уникальными ключами и иконками", () => {
  assert.equal(ACHIEVEMENTS.length, 30);
  assert.equal(new Set(ACHIEVEMENTS.map((a) => a.key)).size, 30, "ключи уникальны");
  assert.equal(new Set(ACHIEVEMENTS.map((a) => a.icon)).size, 30, "у каждой цепочки своя иконка");
  assert.equal(new Set(ACHIEVEMENTS.map((a) => a.title)).size, 30, "названия не повторяются");
});

test("категории заполнены по заданию", () => {
  const byCategory = new Map<string, number>();
  for (const a of ACHIEVEMENTS) byCategory.set(a.category, (byCategory.get(a.category) ?? 0) + 1);

  assert.deepEqual([...byCategory.keys()].sort(), [...CATEGORIES].sort(), "лишних категорий нет");
  assert.equal(byCategory.get("PvP"), 6);
  assert.equal(byCategory.get("Рейдовые боссы"), 6);
  assert.equal(byCategory.get("Активность"), 5);
  assert.equal(byCategory.get("Помощь гильдии"), 5);
  assert.equal(byCategory.get("Золото"), 5);
  assert.equal(byCategory.get("Стаж"), 3);
});

test("у каждой цепочки указана единица измерения", () => {
  for (const a of ACHIEVEMENTS) {
    assert.ok(a.unit, `${a.key}: единица обязательна — её показываем на карточке`);
    assert.ok(a.condition.length > 0, `${a.key}: условие обязательно`);
  }
});

test("все стартовые достижения открытые, не секретные", () => {
  assert.equal(ACHIEVEMENTS.filter((a) => a.secret).length, 0);
});

test("цепочки без источника честно помечены", () => {
  // Подставлять похожие данные нельзя: посещение рейда не равно убийству
  // босса. Такие карточки показывают «Источник данных не настроен».
  const pending = ACHIEVEMENTS.filter((a) => a.source === "pending").map((a) => a.key);
  assert.ok(pending.includes("pvp.kills"), "убийств в PvP в данных нет");
  assert.ok(pending.includes("pvp.honor"), "очков чести в данных нет");
  assert.ok(pending.includes("boss.kraken"), "факт убийства босса не фиксируется");
  assert.ok(pending.includes("act.full"), "полное участие отмечается вручную");

  const ready = ACHIEVEMENTS.filter((a) => a.source === "ready").map((a) => a.key);
  assert.ok(ready.includes("act.prime"), "посещение праймов в данных есть");
  assert.ok(ready.includes("gold.paid"), "выплаты в данных есть");
});

test("ключ достижения находится по карте", () => {
  for (const a of ACHIEVEMENTS) assert.equal(ACHIEVEMENT_BY_KEY.get(a.key)?.title, a.title);
  assert.equal(ACHIEVEMENT_BY_KEY.get("нет-такого"), undefined);
});
