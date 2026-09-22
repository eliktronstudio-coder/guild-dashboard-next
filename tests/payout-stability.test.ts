import test, { before, after } from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

/**
 * Доля игрока не должна меняться от того, что заплатили кому-то другому.
 *
 * Раньше доли считались от ОСТАТКА казны, и остаток уменьшался с каждой
 * выплатой: заплатили одному — у всех остальных показанная сумма падала, хотя
 * они ничего не получили. Лечилось это ручной кнопкой «Зарплата», которая
 * делала снимок (PayoutSnapshot). Кнопку убрали, а причину устранили: доли
 * считаются от исходного фонда периода (distributionPools).
 */

let dir: string;
let prisma: typeof import("../src/lib/prisma").prisma;
let queries: typeof import("../src/lib/queries");
let ledger: typeof import("../src/lib/payoutLedger");
let getActivePeriodId: typeof import("../src/lib/period").getActivePeriodId;

before(async () => {
  dir = mkdtempSync(path.join(tmpdir(), "xd-payout-stability-"));
  process.env.DATABASE_URL = `file:${path.join(dir, "test.db").split(path.sep).join("/")}`;

  execFileSync("npx", ["prisma", "migrate", "deploy"], {
    cwd: process.cwd(),
    env: process.env,
    stdio: "pipe",
    shell: true,
  });

  ({ prisma } = await import("../src/lib/prisma"));
  queries = await import("../src/lib/queries");
  ledger = await import("../src/lib/payoutLedger");
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
  await prisma.payment.deleteMany({});
  await prisma.activityParticipant.deleteMany({});
  await prisma.activity.deleteMany({});
  await prisma.treasuryTransaction.deleteMany({});
  await prisma.player.deleteMany({});
}

/** Двое ходят в одну активность, в казне продажа Прайма. */
async function twoPlayersOneSale(amount = 10_000) {
  const a = await prisma.player.create({ data: { name: "А", role: "Танк" } });
  const b = await prisma.player.create({ data: { name: "Б", role: "ДД" } });
  await prisma.activity.create({
    data: {
      name: "Кракен",
      category: "Прайм",
      periodId: await getActivePeriodId(),
      participants: { create: [{ playerId: a.id }, { playerId: b.id }] },
    },
  });
  await prisma.treasuryTransaction.create({
    data: { description: "Продажа", amount, category: "Прайм" },
  });
  return { a, b };
}

async function salaryByName() {
  const players = await queries.getAllPlayers();
  return new Map(players.map((p) => [p.name, { prime: p.salaryPrime, miniRb: p.salaryMiniRb }]));
}

/** Выплата ровно так же, как это делает POST /api/payments/payout. */
async function pay(playerId: string, playerName: string, category: "Прайм" | "Мини-РБ") {
  const target = (await ledger.resolvePayoutTarget(null))!;
  const amount = (await ledger.resolvePayoutAmount(playerId, category, target))!;
  await ledger.recordPayout({ playerId, playerName, category, amount, target });
  return amount;
}

test("выплата одному не меняет долю другого", async () => {
  await reset();
  const { a, b } = await twoPlayersOneSale();

  const before = await salaryByName();
  assert.equal(before.get("А")!.prime, 3500, "70% с 10 000 пополам");
  assert.equal(before.get("Б")!.prime, 3500);

  const paid = await pay(a.id, "А", "Прайм");
  assert.equal(paid, 3500);

  const after = await salaryByName();
  // Ровно это и ломалось: без кнопки «Зарплата» доля Б падала до 1750.
  assert.equal(after.get("Б")!.prime, 3500, "Б ничего не получил — его доля не имеет права измениться");
  assert.equal(after.get("А")!.prime, 3500, "и у выплаченного сумма тоже остаётся прежней");
});

test("суммы стабильны после выплаты всем", async () => {
  await reset();
  const { a, b } = await twoPlayersOneSale();

  await pay(a.id, "А", "Прайм");
  await pay(b.id, "Б", "Прайм");

  const after = await salaryByName();
  assert.equal(after.get("А")!.prime, 3500);
  assert.equal(after.get("Б")!.prime, 3500);

  // Казна при этом выбрана полностью.
  const treasury = await queries.getTreasuryBreakdown();
  assert.equal(treasury.prime, 0, "весь фонд Прайма выплачен");
  assert.equal(treasury.guild, 3000, "резерв гильдии выплаты не трогают");
});

test("отмена выплаты возвращает всё к исходному состоянию", async () => {
  await reset();
  const { a } = await twoPlayersOneSale();

  const before = await queries.getTreasuryBreakdown();
  await pay(a.id, "А", "Прайм");

  const target = (await ledger.resolvePayoutTarget(null))!;
  const payment = await prisma.payment.findFirst({ where: { playerId: a.id, category: "Прайм" } });
  await ledger.cancelPayout({
    paymentId: payment!.id,
    playerName: "А",
    category: "Прайм",
    amount: payment!.amount,
    target,
  });

  const after = await queries.getTreasuryBreakdown();
  assert.equal(after.prime, before.prime, "казна вернулась");
  assert.equal(after.total, before.total);
  assert.equal((await salaryByName()).get("А")!.prime, 3500, "доля осталась прежней");
});

test("новый доход в периоде увеличивает доли, уже выплаченное не задваивается", async () => {
  await reset();
  const { a } = await twoPlayersOneSale();
  await pay(a.id, "А", "Прайм");

  // Ещё одна продажа в том же периоде.
  await prisma.treasuryTransaction.create({
    data: { description: "Ещё продажа", amount: 10_000, category: "Прайм" },
  });

  const after = await salaryByName();
  // Фонд периода стал 14 000, делится пополам.
  assert.equal(after.get("А")!.prime, 7000);
  assert.equal(after.get("Б")!.prime, 7000);

  // Сверка страницы: остаток казны равен ещё не выплаченному.
  const treasury = await queries.getTreasuryBreakdown();
  const totalPayout = 7000 + 7000;
  const paidSoFar = 3500;
  assert.equal(treasury.prime, totalPayout - paidSoFar, "остаток = начислено минус выплаченное");
});
