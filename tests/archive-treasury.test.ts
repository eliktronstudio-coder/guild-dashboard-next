import test, { before, after } from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

/**
 * Казна внутри архива обязана совпадать с тем, что сайт показывал до
 * архивации. Архивация ничего не пересчитывает — она только помечает
 * операции, поэтому любое расхождение здесь означает, что архив считает
 * казну по своей, отдельной формуле.
 *
 * Именно это и было сломано: архив суммировал операции по полю category
 * напрямую. У продаж дропа это поле обычно пустое (категория лежит на
 * проданных позициях), поэтому Мини-РБ недосчитывался, всё сваливалось в
 * Прайм, резерв гильдии не удерживался и итог не сходился.
 */

let dir: string;
let prisma: typeof import("../src/lib/prisma").prisma;
let queries: typeof import("../src/lib/queries");
let createArchiveInTx: typeof import("../src/lib/archive").createArchiveInTx;

const DATE_FROM = new Date("2026-05-01T00:00:00Z");
const DATE_TO = new Date("2026-05-31T23:59:59Z");
const IN_RANGE = new Date("2026-05-10T12:00:00Z");

before(async () => {
  dir = mkdtempSync(path.join(tmpdir(), "xd-archive-treasury-"));
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
  await prisma.dropItem.deleteMany({});
  await prisma.activityParticipant.deleteMany({});
  await prisma.activity.deleteMany({});
  await prisma.treasuryTransaction.deleteMany({});
  await prisma.player.deleteMany({});
}

async function archive(label = "01.05.2026 — 31.05.2026") {
  const b = await queries.getTreasuryBreakdown();
  return prisma.$transaction((tx) =>
    createArchiveInTx(tx, {
      dateFrom: DATE_FROM,
      dateTo: DATE_TO,
      label,
      pools: { prime: b.prime, miniRb: b.miniRb },
    })
  );
}

/** Продажа дропа: сумма на операции, категория — на проданных позициях. */
async function sellDrop(amount: number, items: { category: string | null; value: number }[]) {
  const tx = await prisma.treasuryTransaction.create({
    data: { description: "Продажа дропа", amount, date: IN_RANGE },
  });
  for (const it of items) {
    await prisma.dropItem.create({
      data: {
        item: "Позиция",
        quantity: 1,
        value: it.value,
        status: "Продано",
        category: it.category,
        treasuryTransactionId: tx.id,
        date: IN_RANGE,
      },
    });
  }
  return tx;
}

test("казна архива совпадает с живой казной до архивации", async () => {
  await reset();
  // Смешанная продажа: половина Мини-РБ, половина Прайм — ровно тот случай,
  // который наивная сумма по category считала неправильно.
  await sellDrop(100_000, [
    { category: "Мини-РБ", value: 50_000 },
    { category: "Прайм", value: 50_000 },
  ]);
  await prisma.treasuryTransaction.create({
    data: { description: "Продажа Мини-РБ", amount: 20_000, date: IN_RANGE, category: "Мини-РБ" },
  });

  const before = await queries.getTreasuryBreakdown();
  assert.ok(before.miniRb > 0 && before.prime > 0 && before.guild > 0, "все три части должны быть ненулевыми");

  const arch = await archive();
  const detail = (await queries.getArchiveDetail(arch.id))!;

  assert.equal(detail.treasuryPrime, before.prime, "Казна Прайм в архиве");
  assert.equal(detail.treasuryMiniRb, before.miniRb, "Казна Мини-РБ в архиве");
  assert.equal(detail.treasuryGuild, before.guild, "Казна гильдии в архиве");
  assert.equal(detail.treasuryTotal, before.total, "итог в архиве");
});

test("категория берётся с проданных позиций, а не с поля операции", async () => {
  await reset();
  // У операции category пустая — вся категорийность в позициях дропа.
  await sellDrop(10_000, [{ category: "Мини-РБ", value: 10_000 }]);

  const arch = await archive();
  const detail = (await queries.getArchiveDetail(arch.id))!;

  // Старый расчёт записал бы все 10 000 в Прайм, потому что category !== "Мини-РБ".
  assert.equal(detail.treasuryMiniRb, 10_000, "продажа Мини-РБ обязана попасть в Мини-РБ");
  assert.equal(detail.treasuryPrime, 0, "и не должна оседать в Прайме");
  assert.equal(detail.treasuryGuild, 0, "с дохода Мини-РБ гильдии ничего не удерживается");
});

test("резерв гильдии в архиве удерживается — 30% с Прайма", async () => {
  await reset();
  await sellDrop(100_000, [{ category: "Прайм", value: 100_000 }]);

  const arch = await archive();
  const detail = (await queries.getArchiveDetail(arch.id))!;

  assert.equal(detail.treasuryPrime, 70_000, "фонд ЗП — 70%");
  assert.equal(detail.treasuryGuild, 30_000, "резерв гильдии — 30%");
  assert.equal(detail.treasuryTotal, 100_000, "итог — вся казна");
});

test("части казны архива в сумме дают итог", async () => {
  await reset();
  await sellDrop(77_777, [
    { category: "Прайм", value: 40_000 },
    { category: "Мини-РБ", value: 30_000 },
    { category: null, value: 7_777 },
  ]);

  const arch = await archive();
  const d = (await queries.getArchiveDetail(arch.id))!;

  assert.equal(
    d.treasuryPrime + d.treasuryMiniRb + d.treasuryGuild,
    d.treasuryTotal,
    "Прайм + Мини-РБ + гильдия обязаны сойтись с итогом"
  );
});

test("выплата за архивный период уменьшает казну этого архива, а не чужую", async () => {
  await reset();
  await sellDrop(100_000, [{ category: "Прайм", value: 100_000 }]);
  const arch = await archive();

  const before = (await queries.getArchiveDetail(arch.id))!;
  assert.equal(before.treasuryPrime, 70_000);

  // Выплата, записанная в книги архива (см. src/lib/payoutLedger.ts).
  await prisma.treasuryTransaction.create({
    data: {
      description: "Выплата ЗП (Прайм): Игрок",
      amount: -10_000,
      category: "Прайм",
      kind: "payout",
      archiveId: arch.id,
    },
  });

  const after = (await queries.getArchiveDetail(arch.id))!;
  assert.equal(after.treasuryPrime, 60_000, "выплата списывается 1:1, минуя 70%-й множитель");
  assert.equal(after.treasuryGuild, 30_000, "резерв гильдии выплата не трогает");

  // А живая казна при этом нулевая — архивная выплата её не касается.
  const live = await queries.getTreasuryBreakdown();
  assert.equal(live.total, 0);
});

test("итог в списке архивов совпадает с итогом внутри архива", async () => {
  await reset();
  await sellDrop(100_000, [
    { category: "Прайм", value: 60_000 },
    { category: "Мини-РБ", value: 40_000 },
  ]);
  const arch = await archive();

  const [row] = await queries.getArchives();
  const detail = (await queries.getArchiveDetail(arch.id))!;

  assert.equal(row.treasuryTotal, detail.treasuryTotal, "в списке и внутри должна стоять одна сумма");
});
