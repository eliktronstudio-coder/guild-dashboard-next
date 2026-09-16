import test, { before, after } from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

/**
 * Снимок зарплаты (кнопка «Зарплата») — на отдельной временной базе.
 *
 * Ключевое свойство: после фиксации выплата одному игроку не должна менять
 * отображаемую/списываемую сумму у остальных, хотя живой расчёт зарплаты
 * (getAllPlayers) делит ОСТАТОК казны и сам по себе от выплат меняется.
 */

let dir: string;
let prisma: typeof import("../src/lib/prisma").prisma;
let queries: typeof import("../src/lib/queries");

before(async () => {
  dir = mkdtempSync(path.join(tmpdir(), "xd-snapshot-test-"));
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
    // временный каталог мог быть занят — не влияет на результат тестов
  }
});

const PERIOD = "2026-01";

test("снимок фиксирует живую зарплату и не даёт создать второй за тот же период", async () => {
  await prisma.payoutSnapshot.deleteMany({});
  await prisma.player.deleteMany({});

  const a = await prisma.player.create({ data: { name: "Игрок А", role: "Танк" } });
  const b = await prisma.player.create({ data: { name: "Игрок Б", role: "Хил" } });

  await prisma.payoutSnapshot.createMany({
    data: [
      { period: PERIOD, playerId: a.id, salaryPrime: 1000, salaryMiniRb: 500 },
      { period: PERIOD, playerId: b.id, salaryPrime: 400, salaryMiniRb: 0 },
    ],
  });

  const map = await queries.getPayoutSnapshotMap(PERIOD);
  assert.deepEqual(map.get(a.id), { salaryPrime: 1000, salaryMiniRb: 500 });
  assert.deepEqual(map.get(b.id), { salaryPrime: 400, salaryMiniRb: 0 });

  // Уникальность (period, playerId) — повторная фиксация того же игрока
  // за тот же период должна упасть, а не тихо перезаписать сумму.
  await assert.rejects(() =>
    prisma.payoutSnapshot.create({ data: { period: PERIOD, playerId: a.id, salaryPrime: 9999, salaryMiniRb: 0 } })
  );
});

test("снимок за другой период не влияет на текущий", async () => {
  await prisma.payoutSnapshot.deleteMany({});
  const a = (await prisma.player.findFirst({ where: { name: "Игрок А" } }))!;

  await prisma.payoutSnapshot.create({
    data: { period: "2025-12", playerId: a.id, salaryPrime: 777, salaryMiniRb: 0 },
  });

  const currentMap = await queries.getPayoutSnapshotMap(PERIOD);
  assert.equal(currentMap.size, 0, "снимок прошлого периода не должен быть виден в текущем");
});

test("без снимка выплата одному двигает живую долю другого; со снимком — нет", async () => {
  await prisma.payoutSnapshot.deleteMany({});
  await prisma.treasuryTransaction.deleteMany({});
  await prisma.dropItem.deleteMany({});
  await prisma.activityParticipant.deleteMany({});
  await prisma.player.deleteMany({});

  // Два игрока с одинаковой посещаемостью Прайма — делят пул пополам.
  const a = await prisma.player.create({ data: { name: "Игрок А", role: "Танк" } });
  const b = await prisma.player.create({ data: { name: "Игрок Б", role: "Хил" } });
  const activity = await prisma.activity.create({ data: { name: "Прайм", category: "Прайм" } });
  await prisma.activityParticipant.createMany({
    data: [
      { activityId: activity.id, playerId: a.id },
      { activityId: activity.id, playerId: b.id },
    ],
  });

  const tx = await prisma.treasuryTransaction.create({ data: { description: "Продажа дропа", amount: 10000 } });
  await prisma.dropItem.create({
    data: { item: "Меч", quantity: 1, value: 10000, status: "Продано", category: "Прайм", treasuryTransactionId: tx.id },
  });

  const before = await queries.getAllPlayers();
  const bBefore = before.find((p) => p.id === b.id)!.salaryPrime;
  assert.ok(bBefore > 0);

  // Симулируем то, что делает POST /api/payments/payout для игрока А:
  // казна Прайма списывается на его текущую (живую) долю.
  const aBefore = before.find((p) => p.id === a.id)!.salaryPrime;
  await prisma.treasuryTransaction.create({
    data: { description: "Выплата ЗП (Прайм): Игрок А", amount: -aBefore, category: "Прайм", kind: "payout" },
  });

  const afterLive = await queries.getAllPlayers();
  const bAfterLive = afterLive.find((p) => p.id === b.id)!.salaryPrime;
  assert.notEqual(bAfterLive, bBefore, "без снимка живая доля Б должна была сдвинуться после выплаты А");

  // Теперь то же самое, но с зафиксированным на старте снимком: сумма Б
  // берётся из снимка, а не из живого расчёта, поэтому остаётся прежней
  // независимо от того, что уже выплачено кому-то другому.
  await prisma.payoutSnapshot.createMany({
    data: [
      { period: PERIOD, playerId: a.id, salaryPrime: aBefore, salaryMiniRb: 0 },
      { period: PERIOD, playerId: b.id, salaryPrime: bBefore, salaryMiniRb: 0 },
    ],
  });
  const snapshotMap = await queries.getPayoutSnapshotMap(PERIOD);
  assert.equal(snapshotMap.get(b.id)?.salaryPrime, bBefore, "снимок должен вернуть ту же сумму, что была до выплаты А");
});
