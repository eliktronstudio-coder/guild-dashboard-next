import test from "node:test";
import assert from "node:assert/strict";

import { pluralizeUnit } from "../src/lib/achievements/units";

test("единицы склоняются по правилам русского языка", () => {
  assert.equal(pluralizeUnit(1, "события"), "событие");
  assert.equal(pluralizeUnit(2, "события"), "события");
  assert.equal(pluralizeUnit(8, "события"), "событий", "именно это и было сломано: «8 события»");
  assert.equal(pluralizeUnit(21, "события"), "событие");
  assert.equal(pluralizeUnit(0, "события"), "событий");
});

test("подводные камни 11–14 и 111–114", () => {
  for (const n of [11, 12, 13, 14, 111, 112, 113, 114]) {
    assert.equal(pluralizeUnit(n, "дни"), "дней", `${n} дней`);
  }
  assert.equal(pluralizeUnit(21, "дни"), "день");
  assert.equal(pluralizeUnit(22, "дни"), "дня");
  assert.equal(pluralizeUnit(101, "дни"), "день");
});

test("золото неисчисляемое — форма одна", () => {
  for (const n of [1, 2, 5, 11, 1000]) assert.equal(pluralizeUnit(n, "золото"), "золота");
});

test("убийства и очки чести", () => {
  assert.equal(pluralizeUnit(1, "убийства"), "убийство");
  assert.equal(pluralizeUnit(3, "убийства"), "убийства");
  assert.equal(pluralizeUnit(10, "убийства"), "убийств");
  assert.equal(pluralizeUnit(1, "очки чести"), "очко чести");
  assert.equal(pluralizeUnit(5, "очки чести"), "очков чести");
});
