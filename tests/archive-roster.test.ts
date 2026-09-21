import test, { before, after } from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

/**
 * Снимок состава в архиве — на отдельной временной базе, чтобы рабочая
 * dev.db не затрагивалась.
 */

let dir: string;
let prisma: typeof import("../src/lib/prisma").prisma;
let queries: typeof import("../src/lib/queries");
let createArchiveInTx: typeof import("../src/lib/archive").createArchiveInTx;
let getActivePeriodId: typeof import("../src/lib/period").getActivePeriodId;

const DATE_FROM = new Date("2026-05-01T00:00:00Z");
const DATE_TO = new Date("2026-05-31T23:59:59Z");
const IN_RANGE = new Date("2026-05-10T12:00:00Z");

before(async () => {
  dir = mkdtempSync(path.join(tmpdir(), "xd-archive-roster-"));
  process.env.DATABASE_URL = `file:${path.join(dir, "test.db").split(path.sep).join("/")}`;

  execFileSync("npx", ["prisma", "migrate", "deploy"], {
    cwd: process.cwd(),
    env: process.env,
    stdio: "pipe",
    shell: true,
  });

  ({ prisma } = await import("../src/lib/prisma"));
  queries = await import("../src/lib/queries");
  ({ createArchiveInTx } = await import("../src/lib/archive"));
  ({ getActivePeriodId } = await import("../src/lib/period"));
});

after(() => {
  try {
    rmSync(dir, { recursive: true, force: true });
  } catch {
    // каталог мог быть занят — на результат тестов не влияет
  }
});

async function reset() {
  await prisma.archivePlayerStat.deleteMany({});
  await prisma.archive.deleteMany({});
  await prisma.activityParticipant.deleteMany({});
  await prisma.activity.deleteMany({});
  await prisma.treasuryTransaction.deleteMany({});
  await prisma.player.deleteMany({});
}

/**
 * Активность в архивируемом диапазоне с заданным составом.
 *
 * periodId обязателен: живая посещаемость считается только по активностям
 * ТЕКУЩЕГО расчётного периода, и без него getAllPlayers вернул бы всем 0% —
 * сравнивать архив было бы не с чем. В бою период проставляется при создании
 * активности, здесь повторяем то же самое.
 */
async function makeActivity(name: string, mode: string, playerIds: string[]) {
  return prisma.activity.create({
    data: {
      name,
      category: "Прайм",
      mode,
      date: IN_RANGE,
      periodId: await getActivePeriodId(),
      participants: { create: playerIds.map((playerId) => ({ playerId })) },
    },
  });
}

/** Архивация ровно так же, как это делает POST /api/archive. */
async function archive(label = "01.05.2026 — 31.05.2026") {
  const b = await queries.getTreasuryBreakdown();
  const pools = { prime: b.prime, miniRb: b.miniRb };
  return prisma.$transaction((tx) => createArchiveInTx(tx, { dateFrom: DATE_FROM, dateTo: DATE_TO, label, pools }));
}

test("в архив попадает весь состав, включая тех, кто никуда не ходил", async () => {
  await reset();
  const ходок = await prisma.player.create({ data: { name: "Ходок", role: "Танк" } });
  const прогульщик = await prisma.player.create({ data: { name: "Прогульщик", role: "Хил" } });

  await makeActivity("Кракен", "PvE", [ходок.id]);
  await makeActivity("Левиафан", "PvE", [ходок.id]);

  const created = await archive();
  const detail = await queries.getArchiveDetail(created.id);
  assert.ok(detail);

  assert.equal(detail!.playerStats.length, 2, "оба игрока обязаны быть в снимке");

  const byName = new Map(detail!.playerStats.map((p) => [p.playerName, p]));
  assert.equal(byName.get("Ходок")!.attendancePct, 100);
  assert.equal(byName.get("Ходок")!.attended, 2);
  assert.equal(byName.get("Ходок")!.activitiesTotal, 2);

  // Прогульщик — не отсутствующая строка, а честный ноль.
  assert.equal(byName.get("Прогульщик")!.attendancePct, 0, "кто не ходил, попадает с 0%, а не пропадает");
  assert.equal(byName.get("Прогульщик")!.attended, 0);
  assert.equal(byName.get("Прогульщик")!.role, "Хил");
});

test("проценты в архиве совпадают с теми, что показывал сайт до архивации", async () => {
  await reset();
  const a = await prisma.player.create({ data: { name: "А", role: "Танк" } });
  const b = await prisma.player.create({ data: { name: "Б", role: "ДД" } });

  // А ходит везде, Б — на половину.
  await makeActivity("Кракен", "PvE", [a.id, b.id]);
  await makeActivity("Левиафан", "PvE", [a.id]);

  const live = await queries.getAllPlayers();
  const liveByName = new Map(live.map((p) => [p.name, p]));

  const created = await archive();
  const detail = await queries.getArchiveDetail(created.id);
  const archByName = new Map(detail!.playerStats.map((p) => [p.playerName, p]));

  for (const name of ["А", "Б"]) {
    assert.equal(
      archByName.get(name)!.attendancePct,
      liveByName.get(name)!.attendancePct,
      `общий процент ${name} не должен измениться при архивации`
    );
    assert.equal(
      archByName.get(name)!.attendancePctPrime,
      liveByName.get(name)!.attendancePctPrime,
      `процент Прайма ${name} не должен измениться при архивации`
    );
    assert.equal(
      archByName.get(name)!.attendancePctMiniRb,
      liveByName.get(name)!.attendancePctMiniRb,
      `процент Мини-РБ ${name} не должен измениться при архивации`
    );
  }

  // И живая посещаемость при этом обнулилась — архив забрал активности.
  const afterLive = await queries.getAllPlayers();
  assert.equal(afterLive.every((p) => p.attendancePct === 0), true, "живая посещаемость должна начаться заново");
});

test("удаление игрока не стирает его из закрытого архива", async () => {
  await reset();
  const уйдёт = await prisma.player.create({ data: { name: "Ушедший", role: "Танк" } });
  const останется = await prisma.player.create({ data: { name: "Оставшийся", role: "ДД" } });
  await makeActivity("Кракен", "PvE", [уйдёт.id, останется.id]);

  const created = await archive();

  await prisma.player.delete({ where: { id: уйдёт.id } });

  const detail = await queries.getArchiveDetail(created.id);
  const row = detail!.playerStats.find((p) => p.playerName === "Ушедший");

  // Именно это раньше и ломалось: участия удаляются каскадом вместе с игроком,
  // и посчитанный на лету архив потерял бы человека целиком.
  assert.ok(row, "удалённый игрок обязан остаться в архиве");
  assert.equal(row!.attendancePct, 100, "его процент обязан сохраниться");
  assert.equal(row!.role, "Танк", "роль на момент архивации сохраняется");
  assert.equal(row!.playerId, null, "ссылка на живого игрока снимается, строка остаётся");
});

test("переименование игрока не переписывает историю задним числом", async () => {
  await reset();
  const p = await prisma.player.create({ data: { name: "СтароеИмя", role: "Танк" } });
  await makeActivity("Кракен", "PvE", [p.id]);

  const created = await archive();
  await prisma.player.update({ where: { id: p.id }, data: { name: "НовоеИмя", role: "Хил" } });

  const detail = await queries.getArchiveDetail(created.id);
  assert.equal(detail!.playerStats[0].playerName, "СтароеИмя", "в архиве остаётся имя на момент архивации");
  assert.equal(detail!.playerStats[0].role, "Танк", "и роль тоже");
});

test("PvP считается отдельным счётчиком, а не процентом", async () => {
  await reset();
  const p = await prisma.player.create({ data: { name: "Боец", role: "ДД" } });
  await makeActivity("Осада", "PvP", [p.id]);
  await makeActivity("Кракен", "PvE", [p.id]);

  const created = await archive();
  const detail = await queries.getArchiveDetail(created.id);
  assert.equal(detail!.playerStats[0].pvpCount, 1, "один PvP-выход");
  assert.equal(detail!.playerStats[0].attended, 2, "но активностей посещено две");
});

test("каждую заархивированную активность можно открыть и увидеть её данные", async () => {
  await reset();
  const p = await prisma.player.create({ data: { name: "Игрок", role: "Танк" } });
  const activity = await makeActivity("Кракен", "PvE", [p.id]);
  await prisma.dropItem.create({
    data: { item: "Меч", quantity: 2, value: 500, activityId: activity.id, category: "Прайм" },
  });

  const created = await archive();
  const detail = await queries.getArchiveDetail(created.id);

  const row = detail!.activities.find((a) => a.id === activity.id);
  assert.ok(row, "активность должна быть в списке архива");
  assert.equal(row!.participants, 1);
  assert.equal(row!.dropTotal, 1000, "2 шт по 500");
  assert.equal(row!.dropCount, 1);

  // Ссылка со страницы архива ведёт на /activities/[id] — проверяем, что эта
  // страница отдаёт архивную активность, а не 404: getActivityById не должен
  // фильтровать по archiveId.
  const opened = await queries.getActivityById(activity.id);
  assert.ok(opened, "заархивированная активность обязана открываться");
  assert.equal(opened!.name, "Кракен");
  assert.equal(opened!.roster.length, 1, "состав активности виден внутри архива");
  assert.equal(opened!.dropTotal, 1000, "дроп активности виден внутри архива");
});

test("удаление архива снимает снимок состава вместе с ним", async () => {
  await reset();
  const p = await prisma.player.create({ data: { name: "Игрок", role: "Танк" } });
  await makeActivity("Кракен", "PvE", [p.id]);

  const created = await archive();
  assert.equal(await prisma.archivePlayerStat.count(), 1);

  // Разархивация возвращает активности в живой учёт, поэтому старый снимок
  // становится неверным и обязан уйти — иначе он остался бы висеть сиротой.
  await prisma.archive.delete({ where: { id: created.id } });
  assert.equal(await prisma.archivePlayerStat.count(), 0, "снимок удаляется каскадом");

  const live = await queries.getAllPlayers();
  assert.equal(live[0].attendancePct, 100, "активность вернулась в живой учёт");
});
