import test from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";

import { SCHEDULE } from "../src/lib/schedule";

// Бот — CommonJS, поэтому подключаем его через require.
const require_ = createRequire(import.meta.url);
const notifier = require_("../discord-bot/notifier.js") as {
  mskNow: (now?: Date) => { day: number; minutes: number; dateKey: string };
  minutesUntil: (slot: { day: number; minutes: number }, now: { day: number; minutes: number }) => number;
  formatTime: (minutes: number) => string;
  LEAD_MINUTES: number;
  WATCHED: string[];
  NOTIFY_CHANNEL_ID: string;
};

const { mskNow, minutesUntil, formatTime, LEAD_MINUTES, WATCHED, NOTIFY_CHANNEL_ID } = notifier;

test("МСК считается из UTC, часовой пояс сервера не влияет", () => {
  // 2026-09-14 09:00 UTC — это 12:00 МСК, понедельник.
  const now = mskNow(new Date("2026-09-14T09:00:00Z"));
  assert.equal(now.day, 1, "понедельник");
  assert.equal(now.minutes, 12 * 60);

  // Полночь по МСК наступает в 21:00 UTC предыдущего дня.
  const midnight = mskNow(new Date("2026-09-14T21:00:00Z"));
  assert.equal(midnight.day, 2, "уже вторник по МСК");
  assert.equal(midnight.minutes, 0);
});

test("до слота считается вперёд, с переходом через неделю", () => {
  const now = { day: 1, minutes: 15 * 60 + 45 }; // понедельник 15:45

  // Алтарь в 16:00 того же дня — через 15 минут.
  assert.equal(minutesUntil({ day: 1, minutes: 16 * 60 }, now), 15);

  // Слот, который уже прошёл сегодня, ждём до следующей недели.
  assert.equal(minutesUntil({ day: 1, minutes: 10 * 60 }, now), 7 * 24 * 60 - (5 * 60 + 45));

  // Воскресный слот — ближе к концу недели, но положительный.
  const untilSunday = minutesUntil({ day: 0, minutes: 12 * 60 }, now);
  assert.ok(untilSunday > 0 && untilSunday < 7 * 24 * 60);
});

test("окно срабатывания ловит ровно одну минуту перед порогом", () => {
  const slot = { day: 4, minutes: 20 * 60 }; // четверг 20:00
  const inWindow = (h: number, m: number) => {
    const left = minutesUntil(slot, { day: 4, minutes: h * 60 + m });
    return left <= LEAD_MINUTES && left >= LEAD_MINUTES - 1;
  };

  // Окно — [14, 15] минут: обычно срабатывает ровно за 15, а если процесс
  // подвис на минуту, успеет за 14. Позже 14 минут не уведомляем никогда —
  // предупреждение впритык бесполезно.
  assert.equal(inWindow(19, 45), true, "ровно за 15 минут — основной случай");
  assert.equal(inWindow(19, 46), true, "за 14 минут — запас на заминку проверки");
  assert.equal(inWindow(19, 44), false, "за 16 минут — ещё рано");
  assert.equal(inWindow(19, 30), false, "за полчаса — рано");
  assert.equal(inWindow(19, 47), false, "за 13 минут — окно уже закрыто");
  assert.equal(inWindow(20, 0), false, "в момент старта — не шлём");
});

test("время выводится с ведущим нулём", () => {
  assert.equal(formatTime(16 * 60), "16:00");
  assert.equal(formatTime(9 * 60 + 5), "09:05");
  assert.equal(formatTime(0), "00:00");
});

test("настройки по умолчанию соответствуют заказу", () => {
  assert.equal(LEAD_MINUTES, 15, "предупреждаем за 15 минут");
  assert.deepEqual(WATCHED, ["Алтарь"]);
  assert.equal(NOTIFY_CHANNEL_ID, "1168236622882557992");
});

test("в расписании есть ровно те слоты Алтаря, которые будут анонсированы", () => {
  const watched = SCHEDULE.filter((s) => WATCHED.includes(s.name));
  assert.equal(watched.length, 10, "5 дней × 2 слота");

  // Для каждого слота момент «за 15 минут» обязан попадать в окно.
  for (const slot of watched) {
    const fifteenBefore = (slot.minutes - LEAD_MINUTES + 24 * 60) % (24 * 60);
    const left = minutesUntil(slot, { day: slot.day, minutes: fifteenBefore });
    assert.equal(left, LEAD_MINUTES, `слот ${slot.day} ${formatTime(slot.minutes)}`);
  }
});
