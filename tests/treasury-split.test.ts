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
