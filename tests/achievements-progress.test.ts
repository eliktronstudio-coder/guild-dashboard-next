import test, { before, after } from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

/**
 * Подсчёт достижений по реальным данным — на отдельной временной базе.
 *
 * Главное, что здесь проверяется: система стартует с нуля. Старые заслуги и
 * задним числом заведённые записи прогресса давать не должны.
 */

let dir: string;
let prisma: typeof import("../src/lib/prisma").prisma;
let progress: typeof import("../src/lib/achievements/progress");
let startLib: typeof import("../src/lib/achievements/start");

const START = new Date("2026-06-01T00:00:00Z");
const BEFORE = new Date("2026-05-20T12:00:00Z");
const AFTER = new Date("2026-06-10T12:00:00Z");

before(async () => {
  dir = mkdtempSync(path.join(tmpdir(), "xd-ach-"));
  process.env.DATABASE_URL = `file:${path.join(dir, "test.db").split(path.sep).join("/")}`;

  execFileSync("npx", ["prisma", "migrate", "deploy"], {
    cwd: process.cwd(),
    env: process.env,
    stdio: "pipe",
    shell: true,
  });

  ({ prisma } = await import("../src/lib/prisma"));
  progress = await import("../src/lib/achievements/progress");
  startLib = await import("../src/lib/achievements/start");

  // Фиксируем дату запуска один раз на весь файл.
  await prisma.appSetting.create({
    data: { key: startLib.ACHIEVEMENTS_STARTED_AT_KEY, value: START.toISOString() },
  });
});

after(() => {
  try {
    rmSync(dir, { recursive: true, force: true });
  } catch {
    // каталог мог быть занят — на результат тестов не влияет
  }
});

async function reset() {
  await prisma.activityParticipant.deleteMany({});
  await prisma.activity.deleteMany({});
  await prisma.payment.deleteMany({});
  await prisma.player.deleteMany({});
}

async function makePlayer(name: string, createdAt = START) {
  return prisma.player.create({ data: { name, role: "ДД", createdAt } });
}

async function attend(
  playerId: string,
  opts: { date: Date; category?: string; mode?: string; archived?: boolean }
) {
  const activity = await prisma.activity.create({
    data: {
      name: "Событие",
      category: opts.category ?? "Прайм",
      mode: opts.mode ?? "PvE",
      date: opts.date,
      participants: { create: [{ playerId }] },
    },
  });
  if (opts.archived) {
    const arch = await prisma.archive.create({
      data: { dateFrom: BEFORE, dateTo: AFTER, label: "архив" },
    });
    await prisma.activity.update({ where: { id: activity.id }, data: { archiveId: arch.id } });
  }
  return activity;
}

const metricsFor = async (playerId: string, now = AFTER) => progress.getMetricsForPlayer(playerId, now);

/* ——— Учёт с нуля ——— */

test("события до запуска системы прогресса не дают", async () => {
  await reset();
  const p = await makePlayer("А");

  await attend(p.id, { date: BEFORE });
  await attend(p.id, { date: BEFORE, category: "Мини-РБ" });

  const m = await metricsFor(p.id);
  assert.equal(m["act.prime"], 0, "старый прайм не засчитан");
  assert.equal(m["act.mini"], 0);
  assert.equal(m["act.unique"], 0);
  assert.equal(m["act.days"], 0);
});

test("импорт старого события задним числом прогресса не даёт", async () => {
  await reset();
  const p = await makePlayer("А");

  // Запись заведена сегодня, но само событие — из прошлого. Смотрим на дату
  // события, а не на дату записи.
  await attend(p.id, { date: BEFORE });

  assert.equal((await metricsFor(p.id))["act.prime"], 0);
});

test("события после запуска считаются", async () => {
  await reset();
  const p = await makePlayer("А");

  await attend(p.id, { date: AFTER });
  await attend(p.id, { date: AFTER, category: "Мини-РБ" });
  await attend(p.id, { date: AFTER, mode: "PvP" });

  const m = await metricsFor(p.id);
  assert.equal(m["act.prime"], 2, "прайм и PvP-прайм");
  assert.equal(m["act.mini"], 1);
  assert.equal(m["pvp.battles"], 1);
  assert.equal(m["act.unique"], 3, "всего три мероприятия");
});

test("дата запуска записывается один раз и не меняется", async () => {
  const first = await startLib.getAchievementsStartedAt(new Date("2026-01-01T00:00:00Z"));
  const second = await startLib.getAchievementsStartedAt(new Date("2027-01-01T00:00:00Z"));

  assert.equal(first.toISOString(), START.toISOString());
  assert.equal(second.toISOString(), START.toISOString(), "повторный вызов не переписывает дату");
  assert.equal(await prisma.appSetting.count(), 1, "второй записи не появляется");
});

/* ——— Одно событие, несколько метрик ——— */

test("одно участие двигает несколько метрик, но внутри метрики считается один раз", async () => {
  await reset();
  const p = await makePlayer("А");
  await attend(p.id, { date: AFTER, mode: "PvP" });

  const m = await metricsFor(p.id);
  assert.equal(m["pvp.battles"], 1, "PvP-сражение");
  assert.equal(m["act.prime"], 1, "и прайм");
  assert.equal(m["act.unique"], 1, "и уникальное мероприятие");
  assert.equal(m["act.days"], 1, "и день активности");
});

test("дни считаются уникальными, а не по числу мероприятий", async () => {
  await reset();
  const p = await makePlayer("А");

  const sameDay = new Date("2026-06-10T10:00:00Z");
  const laterSameDay = new Date("2026-06-10T22:00:00Z");
  const nextDay = new Date("2026-06-11T10:00:00Z");

  await attend(p.id, { date: sameDay });
  await attend(p.id, { date: laterSameDay });
  await attend(p.id, { date: nextDay });

  const m = await metricsFor(p.id, new Date("2026-06-12T00:00:00Z"));
  assert.equal(m["act.unique"], 3, "три мероприятия");
  assert.equal(m["act.days"], 2, "но два дня");
  assert.equal(m["tenure.primeDays"], 2, "дни активности, а не календарный стаж");
});

test("дни прайма и мини-РБ считаются раздельно", async () => {
  await reset();
  const p = await makePlayer("А");
  await attend(p.id, { date: new Date("2026-06-10T10:00:00Z") });
  await attend(p.id, { date: new Date("2026-06-11T10:00:00Z"), category: "Мини-РБ" });

  const m = await metricsFor(p.id, new Date("2026-06-12T00:00:00Z"));
  assert.equal(m["tenure.primeDays"], 1);
  assert.equal(m["tenure.miniDays"], 1);
  assert.equal(m["act.days"], 2, "в общих днях оба");
});

/* ——— Архивация и периоды ——— */

test("архивация не сбрасывает достижения", async () => {
  await reset();
  const p = await makePlayer("А");
  await attend(p.id, { date: AFTER });

  const before = (await metricsFor(p.id))["act.prime"];
  assert.equal(before, 1);

  // Ровно то, что ломало бы систему: архив помечает активность, но заслуга
  // никуда не девается.
  await attend(p.id, { date: AFTER, archived: true });

  const after = await metricsFor(p.id);
  assert.equal(after["act.prime"], 2, "заархивированное мероприятие тоже засчитано");
});

/* ——— Стаж ——— */

test("стаж отсчитывается от более поздней даты: запуск или вступление", async () => {
  await reset();
  const old = await makePlayer("Старожил", BEFORE);
  const fresh = await makePlayer("Новичок", new Date("2026-06-11T00:00:00Z"));

  const now = new Date("2026-06-21T00:00:00Z");
  const mOld = await metricsFor(old.id, now);
  const mFresh = await metricsFor(fresh.id, now);

  // Старожил в гильдии дольше, но до запуска стаж не идёт: 1 июня → 21 июня.
  assert.equal(mOld["tenure.days"], 20, "считаем от запуска, а не от вступления");
  assert.equal(mFresh["tenure.days"], 10, "новичку — от его прихода");
});

/* ——— Золото ——— */

test("золото считается за всё время, включая период до запуска", async () => {
  await reset();
  const p = await makePlayer("А");

  await prisma.payment.create({
    data: { playerId: p.id, amount: 1000, category: "Прайм", status: "Выплачено", date: BEFORE },
  });
  await prisma.payment.create({
    data: { playerId: p.id, amount: 500, category: "Мини-РБ", status: "Ожидает", date: AFTER },
  });

  const m = await metricsFor(p.id);
  assert.equal(m["gold.earned"], 1500, "старое золото тоже в зачёт");
  assert.equal(m["gold.prime"], 1000);
  assert.equal(m["gold.mini"], 500);
});

test("«выплачено» отличается от «начислено» статусом", async () => {
  await reset();
  const p = await makePlayer("А");

  await prisma.payment.create({
    data: { playerId: p.id, amount: 700, category: "Прайм", status: "Выплачено", date: AFTER },
  });
  await prisma.payment.create({
    data: { playerId: p.id, amount: 300, category: "Прайм", status: "Ожидает", date: AFTER },
  });

  const m = await metricsFor(p.id);
  assert.equal(m["gold.earned"], 1000, "начислено всё");
  assert.equal(m["gold.paid"], 700, "выплачено только подтверждённое");
});

test("отмена выплаты уменьшает начисленное, а не остаётся заслугой навсегда", async () => {
  await reset();
  const p = await makePlayer("А");

  await prisma.payment.create({
    data: { playerId: p.id, amount: 1000, category: "Прайм", status: "Выплачено", date: AFTER },
  });
  await prisma.payment.create({
    data: { playerId: p.id, amount: -1000, category: "Прайм", status: "Выплачено", date: AFTER },
  });

  assert.equal((await metricsFor(p.id))["gold.earned"], 0);
});

/* ——— Сборка состояния цепочек ——— */

test("цепочки без источника не получают ни очков, ни нулевого прогресса", async () => {
  const built = progress.buildAchievements({ "act.prime": 1000 }, 410);

  const ready = built.items.find((i) => i.key === "act.prime")!;
  assert.equal(ready.progress?.level, 6, "обеспеченная данными цепочка считается");
  assert.equal(ready.progress?.points, 410);

  const pending = built.items.find((i) => i.key === "pvp.honor")!;
  assert.equal(pending.progress, null, "источника нет — прогресса нет, а не ноль");
  assert.equal(pending.source, "pending");
});

test("итоги игрока складываются только из обеспеченных цепочек", async () => {
  const built = progress.buildAchievements({ "act.prime": 20, "act.mini": 10 }, 410);

  assert.equal(built.totalPoints, 30 + 10, "две ступени по прайму и одна по мини");
  assert.equal(built.earnedTiers, 3);
  assert.equal(built.maxPoints, 12_300);
  assert.equal(built.items.length, 30);
});

test("метрики считаются сразу для всех игроков", async () => {
  await reset();
  const [a, b] = [await makePlayer("А"), await makePlayer("Б")];
  await attend(a.id, { date: AFTER });
  await attend(b.id, { date: AFTER, category: "Мини-РБ" });

  const all = await progress.getMetricsForAllPlayers(AFTER);
  assert.equal(all.size, 2);
  assert.equal(all.get(a.id)!["act.prime"], 1);
  assert.equal(all.get(a.id)!["act.mini"], 0);
  assert.equal(all.get(b.id)!["act.mini"], 1);
});
