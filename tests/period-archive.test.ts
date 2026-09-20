import test, { before, after } from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

/**
 * Расчётный период 15→15: посещаемость взвешивается по коэффициенту
 * активности и делится на Прайм/Мини-РБ по названию, а период сам
 * автоматически сменяется на новый, как только реальная дата переходит
 * его endDate — без ручного закрытия и без архивной задолженности.
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

  // Коэффициент теперь хранится на самой активности (Activity.weight) и
  // подставляется автоматически по названию только в API-роуте создания —
  // здесь, создавая активность напрямую через Prisma, задаём его явно, как
  // сделал бы /api/activities при создании "Разъярённый Левиафан Т1"/"Жук".
  // А ходит только на неё (вес 1.5), Б — только на "Жук" (вес 0.5). Оба
  // названия — Прайм (не входят в список Мини-РБ АГЛ/АГЛ Т2/Кошка).
  // Суммарный вес периода: 1.5 + 0.5 = 2.
  await prisma.activity.create({
    data: {
      name: "Разъярённый Левиафан Т1",
      category: "Прайм",
      weight: 1.5,
      periodId: activePeriodId,
      participants: { create: [{ playerId: a.id }] },
    },
  });
  await prisma.activity.create({
    data: {
      name: "Жук",
      category: "Прайм",
      weight: 0.5,
      periodId: activePeriodId,
      participants: { create: [{ playerId: b.id }] },
    },
  });

  const players = await queries.getAllPlayers();
  const aRow = players.find((p) => p.id === a.id)!;
  const bRow = players.find((p) => p.id === b.id)!;

  assert.equal(aRow.attendancePctPrime, 75, "1.5 из суммарных 2.0 весов = 75%");
  assert.equal(bRow.attendancePctPrime, 25, "0.5 из суммарных 2.0 весов = 25%");
});

test("АГЛ, АГЛ Т2 и Кошка — Мини-РБ по названию, остальное — Прайм, независимо от выбранной категории", async () => {
  await prisma.activityParticipant.deleteMany({});
  await prisma.activity.deleteMany({});
  await prisma.player.deleteMany({});

  const activePeriodId = await period.getActivePeriodId();

  const a = await prisma.player.create({ data: { name: "Игрок А", role: "Танк" } });
  const b = await prisma.player.create({ data: { name: "Игрок Б", role: "Хил" } });
  const c = await prisma.player.create({ data: { name: "Игрок В", role: "Маг" } });

  // Категория в БД намеренно указана НЕПРАВИЛЬНО (наоборот) — проверяем, что
  // расчёт опирается на название, а не на выбор админа.
  await prisma.activity.create({
    data: { name: "АГЛ Т1", category: "Прайм", periodId: activePeriodId, participants: { create: [{ playerId: a.id }] } },
  });
  await prisma.activity.create({
    data: { name: "Кошка (вечер)", category: "Прайм", periodId: activePeriodId, participants: { create: [{ playerId: a.id }] } },
  });
  await prisma.activity.create({
    data: { name: "Фесаникс", category: "Мини-РБ", periodId: activePeriodId, participants: { create: [{ playerId: b.id }] } },
  });
  // PvP всегда Прайм, даже если бы совпало по названию с Мини-РБ.
  await prisma.activity.create({
    data: { name: "Кошка", mode: "PvP", category: "Мини-РБ", periodId: activePeriodId, participants: { create: [{ playerId: c.id }] } },
  });

  const players = await queries.getAllPlayers();
  const aRow = players.find((p) => p.id === a.id)!;
  const bRow = players.find((p) => p.id === b.id)!;
  const cRow = players.find((p) => p.id === c.id)!;

  assert.ok(aRow.attendancePctMiniRb > 0, "АГЛ и Кошка должны попасть в Мини-РБ несмотря на category=Прайм в БД");
  assert.equal(aRow.attendancePctPrime, 0, "А не ходил ни на одну активность категории Прайм по названию");
  assert.ok(bRow.attendancePctPrime > 0, "Фесаникс — Прайм по названию несмотря на category=Мини-РБ в БД");
  assert.equal(bRow.attendancePctMiniRb, 0);
  assert.ok(cRow.attendancePctPrime > 0, "PvP всегда Прайм, даже если название совпадает с Кошкой");
  assert.equal(cRow.attendancePctMiniRb, 0);
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

test("истёкший период автоматически закрывается и заменяется следующим циклом, казна не трогается", async () => {
  await prisma.payment.deleteMany({});
  await prisma.treasuryTransaction.deleteMany({});
  await prisma.accountingPeriod.deleteMany({});

  // Период, чей endDate уже в прошлом — как если бы сайт не открывали
  // несколько дней после 15-го числа.
  const staleStart = new Date(2026, 6, 15);
  const staleEnd = new Date(2026, 7, 15);
  const stale = await prisma.accountingPeriod.create({
    data: { startDate: staleStart, endDate: staleEnd, label: period.periodLabel(staleStart, staleEnd), status: "active" },
  });
  await prisma.treasuryTransaction.create({ data: { description: "Продажа", amount: 5000, periodId: stale.id } });
  const treasuryBefore = await queries.getTreasuryBreakdown();

  const active = await period.getActivePeriod();

  assert.notEqual(active.id, stale.id, "должен вернуться новый период, а не истёкший");
  assert.equal(active.status, "active");

  const closedStale = await prisma.accountingPeriod.findUnique({ where: { id: stale.id } });
  assert.equal(closedStale?.status, "closed", "старый период помечается closed");
  assert.ok(closedStale?.closedAt, "проставляется дата закрытия");

  const treasuryAfter = await queries.getTreasuryBreakdown();
  assert.deepEqual(treasuryAfter, treasuryBefore, "автоматическая смена периода не должна менять баланс казны");

  const again = await period.getActivePeriod();
  assert.equal(again.id, active.id, "повторный вызов возвращает тот же новый период, не плодит ещё один");
});
