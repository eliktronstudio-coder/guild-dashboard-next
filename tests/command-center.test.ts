import test, { before, after } from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { prepareDatabase } from "./prepare-database";
import { computeAttendanceMaps } from "../src/lib/attendance";
import { computeSalaryMap } from "../src/lib/salary";
import { csvCell, parseDay, positivePage } from "../src/lib/report-filters";
import { reconcileLayout } from "../src/lib/dashboardLayout";
let directory: string;
let prisma: typeof import("../src/lib/prisma").prisma;
let sell: typeof import("../src/lib/sales").sellInventory;
let ledger: typeof import("../src/lib/payoutLedger");
let reports: typeof import("../src/lib/statistics");
before(async () => {
  directory = mkdtempSync(path.join(tmpdir(), "xd-command-center-"));
  process.env.DATABASE_URL = "file:" + path.join(directory, "test.db");
  prepareDatabase();
  execFileSync("npx", ["prisma", "migrate", "deploy"], {
    stdio: "pipe",
    env: process.env,
  });
  ({ prisma } = await import("../src/lib/prisma"));
  ({ sellInventory: sell } = await import("../src/lib/sales"));
  ledger = await import("../src/lib/payoutLedger");
  reports = await import("../src/lib/statistics");
});
after(async () => {
  await prisma?.$disconnect();
  rmSync(directory, { recursive: true, force: true });
});

test("attendance counts completed records only and deduplicates each roster", () => {
  const record = {
    name: "PvP",
    mode: "PvP",
    category: "Мини-РБ",
    weight: 1,
    participants: [{ playerId: "a" }, { playerId: "a" }],
  };
  const maps = computeAttendanceMaps([
    record,
    { ...record, participants: [] },
    { ...record, status: "Отменено" },
    { ...record, status: "Запланировано" },
    { ...record, date: new Date("2099-01-01") },
  ]);
  assert.equal(maps.overall.get("a"), 50);
  assert.equal(maps.prime.get("a"), 50);
  assert.equal(maps.attended.get("a"), 1);
  assert.equal(maps.totals.overall, 2);
});
test("salary excludes below 20%, uses coefficients and conserves the fund", () => {
  const result = computeSalaryMap(
    [
      { id: "a", salaryCoefficient: 1 },
      { id: "b", salaryCoefficient: 0.5 },
      { id: "c", salaryCoefficient: 1.25 },
    ],
    new Map([
      ["a", 50],
      ["b", 50],
      ["c", 19],
    ]),
    100001,
  );
  assert.equal(result.get("c"), 0);
  assert.equal(
    [...result.values()].reduce((a, b) => a + b, 0),
    100001,
  );
  assert.ok(result.get("a")! > result.get("b")!);
  assert.deepEqual(
    [
      ...computeSalaryMap(
        [{ id: "c", salaryCoefficient: 1 }],
        new Map([["c", 19]]),
        100,
      ).values(),
    ],
    [0],
  );
});
test("CSV guards formulas including leading whitespace; dates and pages are bounded", () => {
  for (const value of ["=1+1", " +SUM(A1)", "\t@evil", "\n-1"])
    assert.ok(csvCell(value).startsWith("\"'"));
  assert.equal(csvCell('a"b'), '"a""b"');
  assert.equal(parseDay("2026-02-30"), null);
  assert.equal(
    parseDay("2028-02-29")?.toISOString(),
    "2028-02-29T00:00:00.000Z",
  );
  assert.equal(positivePage("Infinity"), 1);
  assert.equal(positivePage("1.5"), 1);
});
test("dashboard layout preserves hidden state without duplicate or unknown panels", () => {
  const result = reconcileLayout(
    JSON.stringify([
      { id: "a", hidden: true, span: 99, height: 99999 },
      { id: "a" },
      { id: "unknown" },
    ]),
    [
      { id: "a", span: 4, height: null },
      { id: "b", span: 4, height: null },
    ],
  );
  assert.equal(result.length, 2);
  assert.equal(result[0].hidden, true);
  assert.equal(result[0].span, 12);
  assert.equal(result[0].height, 1200);
});
test("sale retry produces one transaction and one stock deduction; altered replay fails", async () => {
  const item = await prisma.dropItem.create({
    data: {
      item: "Меч",
      quantity: 3,
      value: 100,
      warehouse: "ХД",
      category: "Прайм",
    },
  });
  const request = { entryIds: [item.id], quantity: 1, amount: 100 };
  const first = await sell(request, "admin", "request-sale-00000001");
  const repeat = await sell(request, "admin", "request-sale-00000001");
  assert.equal(first.transactionId, repeat.transactionId);
  assert.equal(repeat.repeated, true);
  assert.equal(
    (await prisma.dropItem.findUniqueOrThrow({ where: { id: item.id } }))
      .quantity,
    2,
  );
  await assert.rejects(
    sell({ ...request, amount: 200 }, "admin", "request-sale-00000001"),
    /другой продажи/,
  );
  const breakdown = await import("../src/lib/queries").then((q) =>
    q.getTreasuryBreakdown(),
  );
  assert.equal(breakdown.prime, 70);
  assert.equal(breakdown.guild, 30);
});
test("competing sales cannot sell the last item twice", async () => {
  const item = await prisma.dropItem.create({
    data: {
      item: "Щит",
      quantity: 1,
      value: 100,
      warehouse: "ХД",
      category: "Мини-РБ",
    },
  });
  const result = await Promise.allSettled([
    sell(
      { entryIds: [item.id], quantity: 1, amount: 100 },
      "admin",
      "request-sale-00000002",
    ),
    sell(
      { entryIds: [item.id], quantity: 1, amount: 100 },
      "admin",
      "request-sale-00000003",
    ),
  ]);
  assert.equal(result.filter((r) => r.status === "fulfilled").length, 1);
  assert.equal(
    await prisma.dropItem.count({ where: { item: "Щит", status: "Продано" } }),
    1,
  );
  const breakdown = await import("../src/lib/queries").then((q) =>
    q.getTreasuryBreakdown(),
  );
  assert.equal(breakdown.miniRb, 100);
});
test("payout and cancellation retry keep one financial effect and retain payment history", async () => {
  const player = await prisma.player.create({
    data: { name: "Выплата", role: "Танк" },
  });
  const target = await ledger.resolvePayoutTarget(null);
  assert.ok(target);
  const input = {
    playerId: player.id,
    playerName: player.name,
    category: "Мини-РБ" as const,
    amount: 50,
    target,
  };
  await ledger.recordPayout(input);
  await ledger.recordPayout(input);
  const payments = await prisma.payment.findMany({
    where: { playerId: player.id },
  });
  assert.equal(payments.length, 1);
  assert.equal(
    await prisma.treasuryTransaction.count({
      where: { description: { contains: player.name }, amount: -50 },
    }),
    1,
  );
  await ledger.cancelPayout({ ...input, paymentId: payments[0].id });
  await ledger.cancelPayout({ ...input, paymentId: payments[0].id });
  assert.equal(
    (await prisma.payment.findUniqueOrThrow({ where: { id: payments[0].id } }))
      .status,
    "Отменено",
  );
  assert.equal(
    await prisma.treasuryTransaction.count({
      where: { description: { contains: player.name }, amount: 50 },
    }),
    1,
  );
});
test("report distinguishes unique players, visits, finance access and confirmed PvP results", async () => {
  const player = await prisma.player.create({
    data: { name: "Аналитика", role: "Хил" },
  });
  const period = await import("../src/lib/period").then((p) =>
    p.getActivePeriod(),
  );
  for (const status of ["К выплате", "К выплате", "Отменено", "Запланировано"])
    await prisma.activity.create({
      data: {
        name: "PvP",
        mode: "PvP",
        category: "Прайм",
        date: new Date(),
        periodId: period.id,
        status,
        participants: {
          create: { playerId: player.id, pvpKills: 3, honorPoints: 100 },
        },
      },
    });
  const member = await reports.getStatistics(
    { period: "current" },
    { sub: "member", username: "member", role: "member" },
  );
  assert.equal(member.summary.activities, 2);
  assert.equal(member.summary.unique, 1);
  assert.equal(member.summary.participations, 2);
  assert.equal(member.summary.wins, 0);
  assert.equal(member.summary.kills, 6);
  assert.equal(member.rows.find((p) => p.id === player.id)?.salary, null);
  const admin = await reports.getStatistics(
    { period: "current" },
    { sub: "admin", username: "admin", role: "admin" },
  );
  assert.notEqual(admin.rows.find((p) => p.id === player.id)?.salary, null);
});
test("archive report retains frozen nickname and attendance after profile changes", async () => {
  const player = await prisma.player.create({
    data: { name: "Старый ник", role: "Маг" },
  });
  const archive = await prisma.archive.create({
    data: {
      label: "Тестовый архив",
      dateFrom: new Date("2026-09-15"),
      dateTo: new Date("2026-10-14T23:59:59Z"),
      playerStats: {
        create: {
          playerId: player.id,
          playerName: player.name,
          role: "Маг",
          attendancePct: 50,
          attendancePctPrime: 75,
          attendancePctMiniRb: 25,
          pvpCount: 2,
          attended: 5,
          activitiesTotal: 10,
          salaryPrime: 123,
          salaryMiniRb: 456,
        },
      },
    },
  });
  await prisma.player.update({
    where: { id: player.id },
    data: { name: "Новый ник" },
  });
  const report = await reports.getStatistics(
    { archive: archive.id },
    { sub: "admin", username: "admin", role: "admin" },
  );
  assert.equal(report.rows[0].name, "Старый ник");
  assert.equal(report.rows[0].attendance, 50);
  assert.equal(report.rows[0].salary, 579);
});
test("login limiter is persistent and resets only after the window", async () => {
  const { consumeAuthAttempt } = await import("../src/lib/auth-limit");
  const start = Date.now();
  for (let i = 0; i < 10; i++)
    assert.equal(await consumeAuthAttempt("account", start), 0);
  assert.equal(await consumeAuthAttempt("ACCOUNT", start), 900);
  assert.equal(await consumeAuthAttempt("account", start + 900001), 0);
});

test("sale cancellation keeps original audit row and restores inventory and category funds once", async () => {
  const item = await prisma.dropItem.create({
    data: {
      item: "Отмена",
      quantity: 2,
      value: 1000,
      warehouse: "ХД",
      category: "Мини-РБ",
    },
  });
  const before = await import("../src/lib/queries").then((q) =>
    q.getTreasuryBreakdown(),
  );
  const sale = await sell(
    { entryIds: [item.id], quantity: 1, amount: 1000 },
    "admin",
    "request-sale-00000004",
  );
  const { reverseTreasuryTransaction } =
    await import("../src/lib/treasury-reversal");
  await reverseTreasuryTransaction(sale.transactionId);
  await reverseTreasuryTransaction(sale.transactionId);
  assert.equal(
    (
      await prisma.treasuryTransaction.findUniqueOrThrow({
        where: { id: sale.transactionId },
      })
    ).amount,
    1000,
  );
  assert.equal(
    await prisma.treasuryTransaction.count({
      where: { reversalOfId: sale.transactionId },
    }),
    1,
  );
  assert.equal(
    (
      await prisma.dropItem.aggregate({
        where: { item: "Отмена", status: "Не продано" },
        _sum: { quantity: true },
      })
    )._sum.quantity,
    2,
  );
  const after = await import("../src/lib/queries").then((q) =>
    q.getTreasuryBreakdown(),
  );
  assert.deepEqual(after, before);
});

test('mixed-sale charts use the same category split as treasury and never count the full sale twice', async () => {
  const queries = await import('../src/lib/queries');
  const before = (await queries.getTreasuryChartCombined()).at(-1)!;
  const transaction = await prisma.treasuryTransaction.create({data:{description:'Смешанная продажа графика',amount:100}});
  await prisma.dropItem.createMany({data:[{item:'Прайм график',category:'Прайм',value:25,quantity:1,status:'Продано',treasuryTransactionId:transaction.id},{item:'Мини график',category:'Мини-РБ',value:75,quantity:1,status:'Продано',treasuryTransactionId:transaction.id}]});
  const after = (await queries.getTreasuryChartCombined()).at(-1)!;
  assert.equal(after.gold-before.gold,100);
  assert.equal(after.goldPrime-before.goldPrime,25);
  assert.equal(after.goldMiniRb-before.goldMiniRb,75);
});

test('ledger filters keep personal payouts out of member exports and validate dates', async () => {
  const {ledgerFilters} = await import('../src/lib/ledger-filters');
  const member = ledgerFilters({ledgerDirection:'expense'},false);
  assert.equal(member.error,null);
  assert.deepEqual(member.where.OR,[{kind:null},{kind:{not:'payout'}}]);
  assert.deepEqual(member.where.amount,{lt:0});
  assert.equal(ledgerFilters({ledgerFrom:'2026-02-30'},true).error,'Проверьте даты журнала операций.');
  assert.equal(csvCell(-1000),'"-1000"');
});
