import test, { before, after } from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

/**
 * Разбивка казны по категориям — на отдельной временной базе, чтобы
 * рабочая dev.db не затрагивалась.
 */

let dir: string;
let prisma: typeof import("../src/lib/prisma").prisma;
let queries: typeof import("../src/lib/queries");

before(async () => {
  dir = mkdtempSync(path.join(tmpdir(), "xd-treasury-test-"));
  process.env.DATABASE_URL = `file:${path.join(dir, "test.db").split(path.sep).join("/")}`;

  execFileSync("npx", ["prisma", "migrate", "deploy"], {
    cwd: process.cwd(),
    env: process.env,
    stdio: "pipe",
    shell: true,
  });

  ({ prisma } = await import("../src/lib/prisma"));
  queries = await import("../src/lib/queries");
});

after(() => {
  try {
    rmSync(dir, { recursive: true, force: true });
  } catch {
    // каталог мог быть занят — на результат тестов не влияет
  }
});

test("продажа Мини-РБ целиком попадает в казну Мини-РБ", async () => {
  await prisma.treasuryTransaction.deleteMany({});
  await prisma.treasuryTransaction.create({
    data: { description: "Продажа Мини-РБ: Кракен — аукцион", amount: 5000, category: "Мини-РБ" },
  });

  const b = await queries.getTreasuryBreakdown();
  assert.equal(b.miniRb, 5000, "вся сумма должна уйти в Мини-РБ");
  assert.equal(b.prime, 0);
  // Резерв гильдии с дохода Мини-РБ не удерживается.
  assert.equal(b.guild, 0, "гильдии с продажи Мини-РБ ничего не достаётся");
});

test("операция без категории остаётся в остатке гильдии", async () => {
  await prisma.treasuryTransaction.deleteMany({});
  await prisma.treasuryTransaction.create({ data: { description: "Прочее", amount: 1000 } });

  const b = await queries.getTreasuryBreakdown();
  assert.equal(b.miniRb, 0);
  assert.equal(b.guild, 1000);
});

test("части разбивки в сумме дают всю казну", async () => {
  await prisma.treasuryTransaction.deleteMany({});
  await prisma.treasuryTransaction.createMany({
    data: [
      { description: "Продажа Мини-РБ — аукцион", amount: 5000, category: "Мини-РБ" },
      { description: "Прочее", amount: 1000 },
      { description: "Ещё продажа Мини-РБ — аукцион", amount: 2500, category: "Мини-РБ" },
    ],
  });

  const b = await queries.getTreasuryBreakdown();
  assert.equal(b.total, 8500);
  assert.equal(b.miniRb, 7500);
  assert.equal(b.prime + b.miniRb + b.guild, b.total, "разбивка не должна терять или дублировать золото");
});

test("категория позиций дропа важнее категории операции", async () => {
  await prisma.treasuryTransaction.deleteMany({});
  await prisma.dropItem.deleteMany({});

  // Операция помечена как Мини-РБ, но к ней привязан проданный дроп
  // категории Прайм. Двойного счёта быть не должно.
  const tx = await prisma.treasuryTransaction.create({
    data: { description: "Смешанная", amount: 1000, category: "Мини-РБ" },
  });
  await prisma.dropItem.create({
    data: {
      item: "Меч",
      quantity: 1,
      value: 1000,
      status: "Продано",
      category: "Прайм",
      treasuryTransactionId: tx.id,
    },
  });

  const b = await queries.getTreasuryBreakdown();
  assert.equal(b.prime + b.miniRb + b.guild, b.total, "сумма не должна разъехаться");
  assert.equal(b.miniRb, 0, "категория позиций точнее — сумма не должна попасть в Мини-РБ дважды");
});

test("выплата ЗП из Прайма списывает сумму полностью, минуя 70%-й множитель", async () => {
  await prisma.treasuryTransaction.deleteMany({});
  await prisma.dropItem.deleteMany({});

  // 10 000 дохода Прайма (через проданный дроп) -> в фонд ЗП идёт 70% = 7000.
  const tx = await prisma.treasuryTransaction.create({
    data: { description: "Продажа дропа", amount: 10000 },
  });
  await prisma.dropItem.create({
    data: { item: "Меч", quantity: 1, value: 10000, status: "Продано", category: "Прайм", treasuryTransactionId: tx.id },
  });

  const before = await queries.getTreasuryBreakdown();
  assert.equal(before.prime, 7000);
  const guildBefore = before.guild;

  // Выплата 1000 золота из Прайма.
  await prisma.treasuryTransaction.create({
    data: { description: "Выплата ЗП (Прайм): Тест", amount: -1000, category: "Прайм", kind: "payout" },
  });

  const after = await queries.getTreasuryBreakdown();
  assert.equal(after.total, before.total - 1000, "общая казна должна уменьшиться ровно на выплату");
  assert.equal(after.prime, 7000 - 1000, "казна Прайма должна уменьшиться на полную сумму выплаты, не на 70%");
  assert.equal(after.guild, guildBefore, "резерв гильдии не должен меняться от выплаты ЗП");
});

test("выплата ЗП из Мини-РБ списывает сумму полностью, гильдия не меняется", async () => {
  await prisma.treasuryTransaction.deleteMany({});
  await prisma.treasuryTransaction.create({
    data: { description: "Продажа Мини-РБ", amount: 5000, category: "Мини-РБ" },
  });

  const before = await queries.getTreasuryBreakdown();
  assert.equal(before.miniRb, 5000);

  await prisma.treasuryTransaction.create({
    data: { description: "Выплата ЗП (Мини-РБ): Тест", amount: -2000, category: "Мини-РБ", kind: "payout" },
  });

  const after = await queries.getTreasuryBreakdown();
  assert.equal(after.miniRb, 3000);
  assert.equal(after.total, before.total - 2000);
  assert.equal(after.guild, before.guild);
});

test("отмена выплаты (компенсирующая операция) возвращает казну к исходному состоянию", async () => {
  await prisma.treasuryTransaction.deleteMany({});
  await prisma.treasuryTransaction.create({
    data: { description: "Продажа Мини-РБ", amount: 5000, category: "Мини-РБ" },
  });
  const before = await queries.getTreasuryBreakdown();

  await prisma.treasuryTransaction.create({
    data: { description: "Выплата ЗП (Мини-РБ): Тест", amount: -1500, category: "Мини-РБ", kind: "payout" },
  });
  // Компенсация — ровно то, что делает DELETE /api/payments/payout.
  await prisma.treasuryTransaction.create({
    data: { description: "Отмена выплаты ЗП (Мини-РБ): Тест", amount: 1500, category: "Мини-РБ", kind: "payout" },
  });

  const after = await queries.getTreasuryBreakdown();
  assert.deepEqual(after, before, "после отмены казна должна вернуться в точности к исходному состоянию");
});

test("ручная архивация обнуляет живую казну и живую посещаемость, история остаётся в архиве", async () => {
  await prisma.treasuryTransaction.deleteMany({});
  await prisma.activity.deleteMany({});
  await prisma.activityParticipant.deleteMany({});
  await prisma.archive.deleteMany({});
  await prisma.player.deleteMany({});

  const player = await prisma.player.create({ data: { name: "Игрок", role: "Танк" } });
  const activityDate = new Date("2026-05-10T12:00:00Z");
  const activity = await prisma.activity.create({
    data: { name: "Тест", category: "Прайм", date: activityDate, participants: { create: [{ playerId: player.id }] } },
  });
  await prisma.treasuryTransaction.create({
    data: { description: "Продажа дропа", amount: 8000, date: activityDate },
  });

  const before = await queries.getTreasuryBreakdown();
  assert.ok(before.total > 0, "казна должна быть ненулевой до архивации");

  // То же, что делает POST /api/archive: создаёт запись Archive и помечает
  // Activity/TreasuryTransaction в диапазоне дат archiveId, ничего не удаляя.
  const dateFrom = new Date("2026-05-01T00:00:00Z");
  const dateTo = new Date("2026-05-31T23:59:59Z");
  const archive = await prisma.$transaction(async (tx) => {
    const created = await tx.archive.create({
      data: { dateFrom, dateTo, label: "01.05.2026 — 31.05.2026" },
    });
    await tx.activity.updateMany({ where: { date: { gte: dateFrom, lte: dateTo } }, data: { archiveId: created.id } });
    await tx.treasuryTransaction.updateMany({
      where: { date: { gte: dateFrom, lte: dateTo } },
      data: { archiveId: created.id },
    });
    return created;
  });

  const after = await queries.getTreasuryBreakdown();
  assert.equal(after.total, 0, "живая казна должна обнулиться после архивации");
  assert.equal(after.prime, 0);
  assert.equal(after.miniRb, 0);
  assert.equal(after.guild, 0);

  const activities = await queries.getAllActivities();
  assert.equal(activities.length, 0, "заархивированная активность не должна быть видна на /activities");

  const detail = await queries.getArchiveDetail(archive.id);
  assert.ok(detail, "детали архива должны быть доступны");
  assert.equal(detail!.activities.length, 1, "активность должна быть видна внутри архива");
  assert.equal(detail!.transactions.length, 1, "операция казны должна быть видна внутри архива");
  assert.equal(detail!.transactions[0].amount, 8000, "сумма операции сохраняется, а не удаляется");

  // Новая операция ПОСЛЕ архивации должна считаться в живой казне, не в архиве.
  await prisma.treasuryTransaction.create({ data: { description: "Новая продажа", amount: 3000 } });
  const afterNewIncome = await queries.getTreasuryBreakdown();
  assert.equal(afterNewIncome.total, 3000, "казна снова копится с 0 после архивации");
});

test("удаление архива возвращает активности и операции в живой учёт, ничего не теряя", async () => {
  await prisma.treasuryTransaction.deleteMany({});
  await prisma.activity.deleteMany({});
  await prisma.activityParticipant.deleteMany({});
  await prisma.archive.deleteMany({});
  await prisma.player.deleteMany({});

  const player = await prisma.player.create({ data: { name: "Игрок2", role: "Хил" } });
  const activityDate = new Date("2026-06-10T12:00:00Z");
  await prisma.activity.create({
    data: { name: "Тест2", category: "Прайм", date: activityDate, participants: { create: [{ playerId: player.id }] } },
  });
  await prisma.treasuryTransaction.create({ data: { description: "Продажа", amount: 4000, date: activityDate } });

  const dateFrom = new Date("2026-06-01T00:00:00Z");
  const dateTo = new Date("2026-06-30T23:59:59Z");
  const archive = await prisma.$transaction(async (tx) => {
    const created = await tx.archive.create({ data: { dateFrom, dateTo, label: "июнь" } });
    await tx.activity.updateMany({ where: { date: { gte: dateFrom, lte: dateTo } }, data: { archiveId: created.id } });
    await tx.treasuryTransaction.updateMany({
      where: { date: { gte: dateFrom, lte: dateTo } },
      data: { archiveId: created.id },
    });
    return created;
  });

  assert.equal((await queries.getTreasuryBreakdown()).total, 0, "казна обнулена после архивации");
  assert.equal((await queries.getAllActivities()).length, 0, "активность спрятана после архивации");

  // То же, что делает DELETE /api/archive/[id] — благодаря onDelete: SetNull
  // на Activity.archiveId/TreasuryTransaction.archiveId удаление записи
  // архива само возвращает связанные строки в живой учёт.
  await prisma.archive.delete({ where: { id: archive.id } });

  const restored = await queries.getTreasuryBreakdown();
  assert.equal(restored.total, 4000, "казна должна вернуться после удаления архива");

  const activities = await queries.getAllActivities();
  assert.equal(activities.length, 1, "активность должна снова быть видна");
  assert.equal(activities[0].name, "Тест2");

  const tx = await prisma.treasuryTransaction.findFirst();
  assert.equal(tx?.archiveId, null, "archiveId должен сброситься в null, а не удалиться сама операция");
});
