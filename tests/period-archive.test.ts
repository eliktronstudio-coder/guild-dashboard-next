import test, { before, after } from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

/**
 * Расчётный период 15→15: закрытие периода фиксирует задолженность в
 * ArchiveSnapshot, казна не обнуляется, а погашение долга из архива
 * списывает из ТЕКУЩЕЙ казны, а не из архивной записи.
 */

let dir: string;
let prisma: typeof import("../src/lib/prisma").prisma;
let queries: typeof import("../src/lib/queries");
let period: typeof import("../src/lib/period");

before(async () => {
  dir = mkdtempSync(path.join(tmpdir(), "xd-period-test-"));
  process.env.DATABASE_URL = `file:${path.join(dir, "test.db").split(path.sep).join("/")}`;

  execFileSync("npx", ["prisma", "migrate", "deploy"], {
    cwd: process.cwd(),
    env: process.env,
    stdio: "pipe",
    shell: true,
  });

  ({ prisma } = await import("../src/lib/prisma"));
  queries = await import("../src/lib/queries");
  period = await import("../src/lib/period");
});

after(() => {
  try {
    rmSync(dir, { recursive: true, force: true });
  } catch {
    // временный каталог мог быть занят — не влияет на результат тестов
  }
});

test("посещаемость Прайма взвешивается по коэффициенту активности, а не считается поровну", async () => {
  await prisma.activityParticipant.deleteMany({});
  await prisma.activity.deleteMany({});
  await prisma.player.deleteMany({});

  const activePeriodId = await period.getActivePeriodId();

  const a = await prisma.player.create({ data: { name: "Игрок А", role: "Танк" } });
  const b = await prisma.player.create({ data: { name: "Игрок Б", role: "Хил" } });

  // А ходит только на "Разъярённый Левиафан" (вес 1.5), Б — только на "АГЛ Т1" (вес 0.5,
  // "Т1" в таблице нет — должен матчиться на базовое "АГЛ" по слову, а не на "АГЛ Т2").
  // Суммарный вес периода: 1.5 + 0.5 = 2.
  await prisma.activity.create({
    data: {
      name: "Разъярённый Левиафан",
      category: "Прайм",
      periodId: activePeriodId,
      participants: { create: [{ playerId: a.id }] },
    },
  });
  await prisma.activity.create({
    data: {
      name: "АГЛ Т1",
      category: "Прайм",
      periodId: activePeriodId,
      participants: { create: [{ playerId: b.id }] },
    },
  });

  const players = await queries.getAllPlayers();
  const aRow = players.find((p) => p.id === a.id)!;
  const bRow = players.find((p) => p.id === b.id)!;

  assert.equal(aRow.attendancePctPrime, 75, "1.5 из суммарных 2.0 весов = 75%");
  assert.equal(bRow.attendancePctPrime, 25, "0.5 из суммарных 2.0 весов = 25%, «АГЛ Т1» должен весить как «АГЛ», а не «АГЛ Т2»");
});

test("активность режима PvP засчитывается в посещаемость Прайма, но PvP-счётчик остаётся отдельным количеством", async () => {
  await prisma.activityParticipant.deleteMany({});
  await prisma.activity.deleteMany({});
  await prisma.player.deleteMany({});

  const activePeriodId = await period.getActivePeriodId();

  const a = await prisma.player.create({ data: { name: "Игрок А", role: "Танк" } });
  const b = await prisma.player.create({ data: { name: "Игрок Б", role: "Хил" } });

  // У активности категория «Мини-РБ» (или вообще не проставлена явно на
  // Прайм), но режим PvP — она всё равно должна считаться как поход на
  // Прайм. Игрок Б на неё не ходил.
  const pvpActivity = await prisma.activity.create({
    data: { name: "PvP ивент", category: "Мини-РБ", mode: "PvP", periodId: activePeriodId },
  });
  await prisma.activityParticipant.create({ data: { activityId: pvpActivity.id, playerId: a.id } });

  const players = await queries.getAllPlayers();
  const aRow = players.find((p) => p.id === a.id)!;
  const bRow = players.find((p) => p.id === b.id)!;

  assert.equal(aRow.attendancePctPrime, 100, "поход на PvP должен засчитаться в посещаемость Прайма");
  assert.equal(bRow.attendancePctPrime, 0, "не ходивший игрок не получает посещаемость Прайма");
  assert.equal(aRow.pvpCount, 1, "PvP-счётчик — это количество походов, а не процент");
});

test("computePeriodBounds охватывает цикл 15→15", () => {
  const { startDate, endDate } = period.computePeriodBounds(new Date(2026, 8, 20)); // 20 сентября
  assert.equal(startDate.getDate(), 15);
  assert.equal(startDate.getMonth(), 8); // сентябрь
  assert.equal(endDate.getDate(), 15);
  assert.equal(endDate.getMonth(), 9); // октябрь

  const before15 = period.computePeriodBounds(new Date(2026, 8, 10)); // 10 сентября — ещё предыдущий цикл
  assert.equal(before15.startDate.getMonth(), 7); // август
});

test("getActivePeriod создаёт период при первом обращении и переиспользует его", async () => {
  await prisma.accountingPeriod.deleteMany({});
  const a = await period.getActivePeriod();
  const b = await period.getActivePeriod();
  assert.equal(a.id, b.id, "повторный вызов не должен плодить периоды");
  assert.equal(a.status, "active");
});

test("закрытие периода создаёт снимок задолженности, казну не обнуляет, открывает новый период", async () => {
  await prisma.archiveSnapshot.deleteMany({});
  await prisma.payment.deleteMany({});
  await prisma.treasuryTransaction.deleteMany({});
  await prisma.dropItem.deleteMany({});
  await prisma.activityParticipant.deleteMany({});
  await prisma.accountingPeriod.deleteMany({});
  await prisma.player.deleteMany({});

  const active = await period.getActivePeriod();

  const a = await prisma.player.create({ data: { name: "Игрок А", role: "Танк" } });
  const b = await prisma.player.create({ data: { name: "Игрок Б", role: "Хил" } });
  const activity = await prisma.activity.create({ data: { name: "Прайм", category: "Прайм", periodId: active.id } });
  await prisma.activityParticipant.createMany({
    data: [
      { activityId: activity.id, playerId: a.id },
      { activityId: activity.id, playerId: b.id },
    ],
  });

  const tx = await prisma.treasuryTransaction.create({
    data: { description: "Продажа дропа", amount: 10000, periodId: active.id },
  });
  await prisma.dropItem.create({
    data: { item: "Меч", quantity: 1, value: 10000, status: "Продано", category: "Прайм", treasuryTransactionId: tx.id },
  });

  const players = await queries.getAllPlayers();
  const aLive = players.find((p) => p.id === a.id)!;
  const bLive = players.find((p) => p.id === b.id)!;
  assert.ok(aLive.salaryPrime > 0 && bLive.salaryPrime > 0);

  // Игрок А получает частичную выплату ДО закрытия периода.
  await prisma.$transaction([
    prisma.payment.create({
      data: { playerId: a.id, amount: aLive.salaryPrime, status: "Выплачено", source: "payout", category: "Прайм", periodId: active.id, archiveMonth: active.id },
    }),
    prisma.treasuryTransaction.create({
      data: { description: "Выплата ЗП (Прайм): Игрок А", amount: -aLive.salaryPrime, category: "Прайм", kind: "payout", periodId: active.id },
    }),
  ]);

  const treasuryBeforeClose = await queries.getTreasuryBreakdown();

  // Симулируем закрытие периода (та же логика, что в /api/periods/close).
  const playersAfterPayout = await queries.getAllPlayers();
  const bLiveAfterPayout = playersAfterPayout.find((p) => p.id === b.id)!;
  const paidA = aLive.salaryPrime;

  await prisma.archiveSnapshot.createMany({
    data: [
      { periodId: active.id, playerId: a.id, playerName: "Игрок А", accruedPrime: paidA, accruedMiniRb: 0, paidPrime: paidA, paidMiniRb: 0 },
      { periodId: active.id, playerId: b.id, playerName: "Игрок Б", accruedPrime: bLiveAfterPayout.salaryPrime, accruedMiniRb: 0, paidPrime: 0, paidMiniRb: 0 },
    ],
  });
  await prisma.accountingPeriod.update({ where: { id: active.id }, data: { status: "closed", closedAt: new Date(), closedBy: "test" } });
  const { startDate: nextStart, endDate: nextEnd } = period.computePeriodBounds(active.endDate);
  const newPeriod = await prisma.accountingPeriod.create({
    data: { startDate: nextStart, endDate: nextEnd, label: period.periodLabel(nextStart, nextEnd), status: "active" },
  });

  // Казна не обнуляется при закрытии.
  const treasuryAfterClose = await queries.getTreasuryBreakdown();
  assert.deepEqual(treasuryAfterClose, treasuryBeforeClose, "закрытие периода не должно менять баланс казны");

  // Новый период стал активным.
  const newActive = await period.getActivePeriod();
  assert.equal(newActive.id, newPeriod.id);
  assert.notEqual(newActive.id, active.id);

  // Задолженность Б осталась в архиве.
  const detail = await queries.getArchivePeriodDetail(active.id);
  assert.ok(detail);
  const bDebt = detail!.players.find((p) => p.playerId === b.id)!;
  assert.equal(bDebt.remainingPrime, bLiveAfterPayout.salaryPrime);

  // Погашение долга Б списывает из ТЕКУЩЕЙ (новой) казны, а не влияет на old-period снимок иначе как через paid-поле.
  const poolBefore = treasuryAfterClose.prime + treasuryAfterClose.miniRb;
  await prisma.$transaction([
    prisma.archiveSnapshot.update({
      where: { periodId_playerId: { periodId: active.id, playerId: b.id } },
      data: { paidPrime: { increment: bDebt.remainingPrime } },
    }),
    prisma.payment.create({
      data: { playerId: b.id, amount: bDebt.remainingPrime, status: "Выплачено", source: "archive", category: "Прайм", periodId: newPeriod.id, archivePeriodId: active.id },
    }),
    prisma.treasuryTransaction.create({
      data: { description: "Погашение долга", amount: -bDebt.remainingPrime, category: "Прайм", kind: "payout", periodId: newPeriod.id },
    }),
  ]);

  const treasuryAfterDebtPay = await queries.getTreasuryBreakdown();
  assert.equal(
    treasuryAfterDebtPay.prime + treasuryAfterDebtPay.miniRb,
    poolBefore - bDebt.remainingPrime,
    "погашение архивного долга должно списываться из текущей казны"
  );

  const detailAfterPay = await queries.getArchivePeriodDetail(active.id);
  const bDebtAfter = detailAfterPay!.players.find((p) => p.playerId === b.id)!;
  assert.equal(bDebtAfter.remainingPrime, 0, "долг должен быть погашен полностью");
});
