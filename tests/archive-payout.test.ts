import test, { before, after } from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

/**
 * Выплата за закрытый (архивный) период — на отдельной временной базе.
 *
 * Главное, что здесь проверяется: выплата за прошлый период не имеет права
 * трогать казну текущего. Иначе люди, отходившие новый период, недосчитались
 * бы своей доли из-за выплаты по старому.
 */

let dir: string;
let prisma: typeof import("../src/lib/prisma").prisma;
let queries: typeof import("../src/lib/queries");
let createArchiveInTx: typeof import("../src/lib/archive").createArchiveInTx;
let getActivePeriodId: typeof import("../src/lib/period").getActivePeriodId;
let payout: typeof import("../src/lib/payoutLedger");

const DATE_FROM = new Date("2026-05-01T00:00:00Z");
const DATE_TO = new Date("2026-05-31T23:59:59Z");
const IN_RANGE = new Date("2026-05-10T12:00:00Z");

before(async () => {
  dir = mkdtempSync(path.join(tmpdir(), "xd-archive-payout-"));
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
  payout = await import("../src/lib/payoutLedger");
});

after(() => {
  try {
    rmSync(dir, { recursive: true, force: true });
  } catch {
    // каталог мог быть занят — на результат тестов не влияет
  }
});

async function reset() {
  await prisma.payment.deleteMany({});
  await prisma.archivePlayerStat.deleteMany({});
  await prisma.archive.deleteMany({});
  await prisma.activityParticipant.deleteMany({});
  await prisma.activity.deleteMany({});
  await prisma.treasuryTransaction.deleteMany({});
  await prisma.player.deleteMany({});
}

async function makeActivity(name: string, playerIds: string[], mode = "PvE") {
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

/**
 * Выплата за закрытый период — через ту же механику, что и POST
 * /api/payments/payout (src/lib/payout.ts). Именно через неё, а не копией
 * её шагов: копия продолжала бы проходить тест, даже если маршрут начнёт
 * списывать из живой казны — то есть проверяла бы сама себя.
 */
async function payArchived(archiveId: string, playerId: string, category: "Прайм" | "Мини-РБ") {
  const target = (await payout.resolvePayoutTarget(archiveId))!;
  const amount = (await payout.resolvePayoutAmount(playerId, category, target))!;
  const player = await prisma.player.findUnique({ where: { id: playerId } });
  await payout.recordPayout({ playerId, playerName: player!.name, category, amount, target });
  return amount;
}

test("суммы фиксируются при архивации и равны тому, что показывала страница выплат", async () => {
  await reset();
  const a = await prisma.player.create({ data: { name: "А", role: "Танк" } });
  const b = await prisma.player.create({ data: { name: "Б", role: "ДД" } });
  await makeActivity("Кракен", [a.id, b.id]);
  await makeActivity("Левиафан", [a.id]);
  await prisma.treasuryTransaction.create({
    data: { description: "Продажа дропа", amount: 10000, date: IN_RANGE, category: "Прайм" },
  });

  // Что сайт показывал до архивации.
  const liveBefore = await queries.getAllPlayers();
  const liveByName = new Map(liveBefore.map((p) => [p.name, p]));
  const liveTotal = liveBefore.reduce((s, p) => s + p.salary, 0);

  const arch = await archive();
  const payout = (await queries.getArchivePayout(arch.id))!;
  const archByName = new Map(payout.players.map((p) => [p.name, p]));

  for (const name of ["А", "Б"]) {
    assert.equal(
      archByName.get(name)!.salaryPrime,
      liveByName.get(name)!.salaryPrime,
      `доля Прайма ${name} не должна измениться при архивации`
    );
    assert.equal(
      archByName.get(name)!.salaryMiniRb,
      liveByName.get(name)!.salaryMiniRb,
      `доля Мини-РБ ${name} не должна измениться при архивации`
    );
  }
  assert.equal(payout.total, liveTotal, "общая сумма к выплате обязана совпасть");
  assert.ok(payout.total > 0, "иначе тест ничего не доказывает");
});

test("сумма долей в архиве в точности равна пулу — золото не теряется на округлении", async () => {
  await reset();
  // Три игрока и сумма, которая нацело на троих не делится.
  const players = [];
  for (const name of ["А", "Б", "В"]) {
    players.push(await prisma.player.create({ data: { name, role: "ДД" } }));
  }
  await makeActivity("Кракен", players.map((p) => p.id));
  await prisma.treasuryTransaction.create({
    data: { description: "Продажа дропа", amount: 10_000, date: IN_RANGE, category: "Прайм" },
  });

  const poolBefore = (await queries.getTreasuryBreakdown()).prime;
  const arch = await archive();
  const payout = (await queries.getArchivePayout(arch.id))!;

  const sum = payout.players.reduce((s, p) => s + p.salaryPrime, 0);
  assert.equal(sum, poolBefore, `сумма долей (${sum}) обязана равняться пулу (${poolBefore})`);
});

test("выплата за закрытый период НЕ трогает казну текущего", async () => {
  await reset();
  const p = await prisma.player.create({ data: { name: "Игрок", role: "Танк" } });
  await makeActivity("Кракен", [p.id]);
  await prisma.treasuryTransaction.create({
    data: { description: "Продажа дропа", amount: 10000, date: IN_RANGE, category: "Прайм" },
  });

  const arch = await archive();

  // Новый период: свежий доход после архивации.
  await prisma.treasuryTransaction.create({ data: { description: "Новая продажа", amount: 50_000, category: "Прайм" } });
  const liveBefore = await queries.getTreasuryBreakdown();
  assert.ok(liveBefore.prime > 0, "живая казна должна быть ненулевой");

  const paid = await payArchived(arch.id, p.id, "Прайм");
  assert.ok(paid > 0, "выплата должна быть ненулевой, иначе тест пустой");

  const liveAfter = await queries.getTreasuryBreakdown();
  // Ровно это и было бы катастрофой: выплата за май списала бы золото,
  // заработанное в новом периоде.
  assert.equal(liveAfter.prime, liveBefore.prime, "Прайм текущего периода не должен измениться");
  assert.equal(liveAfter.miniRb, liveBefore.miniRb, "Мини-РБ текущего периода не должен измениться");
  assert.equal(liveAfter.total, liveBefore.total, "общая живая казна не должна измениться");
  assert.equal(liveAfter.guild, liveBefore.guild, "казна гильдии не должна измениться");
});

test("статус «Выплачено» за закрытый период виден и считается отдельно от текущего", async () => {
  await reset();
  const p = await prisma.player.create({ data: { name: "Игрок", role: "Танк" } });
  await makeActivity("Кракен", [p.id]);
  await prisma.treasuryTransaction.create({
    data: { description: "Продажа дропа", amount: 10000, date: IN_RANGE, category: "Прайм" },
  });
  const arch = await archive();

  const before = (await queries.getArchivePayout(arch.id))!;
  assert.equal(before.players[0].paidPrime, false);
  assert.equal(before.paidTotal, 0);
  assert.equal(before.remaining, before.total);

  const paid = await payArchived(arch.id, p.id, "Прайм");

  const after = (await queries.getArchivePayout(arch.id))!;
  assert.equal(after.players[0].paidPrime, true, "доля должна отметиться выплаченной");
  assert.equal(after.paidTotal, paid);
  assert.equal(after.remaining, after.total - paid);

  // В текущем периоде эта выплата не должна числиться.
  const activePeriod = await getActivePeriodId();
  const liveStatus = await queries.getPayoutStatusMap(activePeriod);
  assert.equal(liveStatus.size, 0, "выплата за архив не должна попадать в текущий период");
});

test("архив с обнулённой казной даёт нулевые суммы, а не ошибку", async () => {
  await reset();
  const p = await prisma.player.create({ data: { name: "Игрок", role: "Танк" } });
  await makeActivity("Кракен", [p.id]);
  // Казны нет вовсе — ровно случай архива, созданного после очистки финансов.

  const arch = await archive();
  const payout = (await queries.getArchivePayout(arch.id))!;

  assert.equal(payout.total, 0);
  assert.equal(payout.recipients, 0);
  assert.equal(payout.players.length, 1, "состав при этом сохраняется");
  assert.equal(payout.players[0].attendancePctPrime, 100, "и проценты тоже");
});

test("список периодов отдаёт архивы и помечает те, где состава нет", async () => {
  await reset();
  const p = await prisma.player.create({ data: { name: "Игрок", role: "Танк" } });
  await makeActivity("Кракен", [p.id]);
  const arch = await archive("01.05.2026 — 31.05.2026");

  const withRoster = await queries.getArchiveOptions();
  assert.equal(withRoster.length, 1);
  assert.equal(withRoster[0].id, arch.id);
  assert.equal(withRoster[0].hasRoster, true);

  // Архив старого образца — без снимка состава.
  await prisma.archivePlayerStat.deleteMany({ where: { archiveId: arch.id } });
  const without = await queries.getArchiveOptions();
  assert.equal(without[0].hasRoster, false, "такой период нельзя выбрать для выплаты");
});

test("удалённому игроку платить нечем, но его строка в архиве остаётся", async () => {
  await reset();
  const p = await prisma.player.create({ data: { name: "Ушедший", role: "Танк" } });
  await makeActivity("Кракен", [p.id]);
  await prisma.treasuryTransaction.create({
    data: { description: "Продажа дропа", amount: 10000, date: IN_RANGE, category: "Прайм" },
  });
  const arch = await archive();

  await prisma.player.delete({ where: { id: p.id } });

  const payout = (await queries.getArchivePayout(arch.id))!;
  assert.equal(payout.players.length, 1, "строка остаётся");
  assert.equal(payout.players[0].id, null, "но ссылки на живого игрока уже нет");
  assert.equal(payout.players[0].name, "Ушедший");
  assert.ok(payout.players[0].salaryPrime > 0, "сумма в истории сохраняется");
  assert.equal(payout.players[0].paidPrime, false, "и отметить её выплаченной невозможно");
});
