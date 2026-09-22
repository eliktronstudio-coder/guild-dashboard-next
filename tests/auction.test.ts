import test, { before, after } from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

/**
 * Живые торги: состояние в базе, ставят сами участники.
 *
 * Главное, что здесь проверяется, — одновременные ставки. Двое жмут «Ставка»
 * в одну секунду, видя одну и ту же цену; если пропустить обоих, второй
 * перебьёт первого, не заплатив шаг.
 */

let dir: string;
let prisma: typeof import("../src/lib/prisma").prisma;
let auction: typeof import("../src/lib/auction");

before(async () => {
  dir = mkdtempSync(path.join(tmpdir(), "xd-auction-"));
  process.env.DATABASE_URL = `file:${path.join(dir, "test.db").split(path.sep).join("/")}`;

  execFileSync("npx", ["prisma", "migrate", "deploy"], {
    cwd: process.cwd(),
    env: process.env,
    stdio: "pipe",
    shell: true,
  });

  ({ prisma } = await import("../src/lib/prisma"));
  auction = await import("../src/lib/auction");
});

after(() => {
  try {
    rmSync(dir, { recursive: true, force: true });
  } catch {
    // каталог мог быть занят — на результат тестов не влияет
  }
});

async function reset() {
  await prisma.auctionBid.deleteMany({});
  await prisma.auction.deleteMany({});
  await prisma.player.deleteMany({});
}

async function players(...names: string[]) {
  const made = [];
  for (const name of names) made.push(await prisma.player.create({ data: { name, role: "ДД" } }));
  return made;
}

function start(startingBid = 100, step = 50) {
  return auction.startAuction({ itemName: "Меч Бездны", startingBid, step, createdBy: "гм" });
}

test("торги открываются с указанной стартовой ценой и шагом", async () => {
  await reset();
  await start(1000, 250);

  const state = (await auction.getActiveAuction())!;
  assert.equal(state.itemName, "Меч Бездны");
  assert.equal(state.currentBid, 1000, "цена стартует со стартовой ставки");
  assert.equal(state.step, 250);
  assert.equal(state.leaderName, null, "лидера ещё нет");
  assert.equal(state.history.length, 0);
});

test("ставка поднимает цену на шаг и делает игрока лидером", async () => {
  await reset();
  const [a] = await players("А");
  await start(100, 50);

  const res = await auction.placeBid({ playerId: a.id, name: "А", expectedBid: 100 });
  assert.deepEqual(res, { ok: true, amount: 150 });

  const state = (await auction.getActiveAuction())!;
  assert.equal(state.currentBid, 150);
  assert.equal(state.leaderName, "А");
  assert.equal(state.leaderPlayerId, a.id);
  assert.equal(state.history[0].name, "А");
  assert.equal(state.history[0].amount, 150);
  assert.equal(state.history[0].kind, "bid");
});

test("одновременные ставки: побеждает одна, вторая отклоняется", async () => {
  await reset();
  const [a, b] = await players("А", "Б");
  await start(100, 50);

  // Оба видят 100 и жмут одновременно.
  const [first, second] = await Promise.all([
    auction.placeBid({ playerId: a.id, name: "А", expectedBid: 100 }),
    auction.placeBid({ playerId: b.id, name: "Б", expectedBid: 100 }),
  ]);

  const ok = [first, second].filter((r) => r.ok);
  const rejected = [first, second].filter((r) => !r.ok);
  assert.equal(ok.length, 1, "принять обе ставки нельзя");
  assert.equal(rejected.length, 1);
  assert.equal(rejected[0].ok === false && rejected[0].reason, "stale");

  // Ровно один шаг, а не два, и ровно одна запись в журнале.
  const state = (await auction.getActiveAuction())!;
  assert.equal(state.currentBid, 150, "цена поднялась на один шаг");
  assert.equal(state.history.length, 1);
});

test("перебить самого себя нельзя", async () => {
  await reset();
  const [a] = await players("А");
  await start(100, 50);

  await auction.placeBid({ playerId: a.id, name: "А", expectedBid: 100 });
  const again = await auction.placeBid({ playerId: a.id, name: "А", expectedBid: 150 });

  assert.equal(again.ok, false);
  assert.equal(again.ok === false && again.reason, "already-leading");
  assert.equal((await auction.getActiveAuction())!.currentBid, 150, "цена не изменилась");
});

test("ставка по устаревшей цене отклоняется", async () => {
  await reset();
  const [a, b] = await players("А", "Б");
  await start(100, 50);

  await auction.placeBid({ playerId: a.id, name: "А", expectedBid: 100 });
  // Б всё ещё видит на экране 100.
  const late = await auction.placeBid({ playerId: b.id, name: "Б", expectedBid: 100 });

  assert.equal(late.ok, false);
  assert.equal(late.ok === false && late.reason, "stale");
  assert.equal((await auction.getActiveAuction())!.leaderName, "А");
});

test("торги идут по очереди: цена растёт на шаг за ставку", async () => {
  await reset();
  const [a, b] = await players("А", "Б");
  await start(100, 50);

  await auction.placeBid({ playerId: a.id, name: "А", expectedBid: 100 });
  await auction.placeBid({ playerId: b.id, name: "Б", expectedBid: 150 });
  await auction.placeBid({ playerId: a.id, name: "А", expectedBid: 200 });

  const state = (await auction.getActiveAuction())!;
  assert.equal(state.currentBid, 250);
  assert.equal(state.leaderName, "А");
  assert.deepEqual(state.history.map((h) => h.amount), [250, 200, 150], "журнал от новых к старым");
});

test("пропуск не меняет цену и не меняет лидера", async () => {
  await reset();
  const [a, b] = await players("А", "Б");
  await start(100, 50);
  await auction.placeBid({ playerId: a.id, name: "А", expectedBid: 100 });

  await auction.skipTurn({ playerId: b.id, name: "Б" });

  const state = (await auction.getActiveAuction())!;
  assert.equal(state.currentBid, 150, "пропуск цену не двигает");
  assert.equal(state.leaderName, "А");
  assert.equal(state.history[0].kind, "skip");
  assert.equal(state.history[0].name, "Б");
});

test("в журнале хранится не больше семи последних записей", async () => {
  await reset();
  const [a, b] = await players("А", "Б");
  await start(100, 50);

  let price = 100;
  for (let i = 0; i < 10; i++) {
    const who = i % 2 === 0 ? { id: a.id, name: "А" } : { id: b.id, name: "Б" };
    const res = await auction.placeBid({ playerId: who.id, name: who.name, expectedBid: price });
    assert.equal(res.ok, true);
    price += 50;
  }

  const state = (await auction.getActiveAuction())!;
  assert.equal(state.history.length, auction.BID_HISTORY_LIMIT, "показываем последние 7");
  assert.equal(state.currentBid, 600, "10 шагов по 50 от 100");
});

test("после завершения торгов ставить нельзя, лидер зафиксирован", async () => {
  await reset();
  const [a] = await players("А");
  await start(100, 50);
  await auction.placeBid({ playerId: a.id, name: "А", expectedBid: 100 });

  const finished = await auction.finishAuction();
  assert.equal(finished!.leaderName, "А", "победителем стал лидер на момент завершения");
  assert.equal(finished!.currentBid, 150);

  assert.equal(await auction.getActiveAuction(), null, "активных торгов больше нет");

  const late = await auction.placeBid({ playerId: a.id, name: "А", expectedBid: 150 });
  assert.equal(late.ok, false);
  assert.equal(late.ok === false && late.reason, "no-auction");
});

test("новые торги закрывают предыдущие — активными бывают только одни", async () => {
  await reset();
  await start(100, 50);
  await start(999, 10);

  const state = (await auction.getActiveAuction())!;
  assert.equal(state.currentBid, 999, "активны последние торги");
  assert.equal(await prisma.auction.count({ where: { status: "active" } }), 1);
  assert.equal(await prisma.auction.count(), 2, "прежние не удаляются, а закрываются");
});

test("удаление игрока не стирает его ставки из журнала", async () => {
  await reset();
  const [a] = await players("А");
  await start(100, 50);
  await auction.placeBid({ playerId: a.id, name: "А", expectedBid: 100 });

  await prisma.player.delete({ where: { id: a.id } });

  const state = (await auction.getActiveAuction())!;
  assert.equal(state.history.length, 1, "запись в журнале остаётся");
  assert.equal(state.history[0].name, "А", "имя сохраняется");
});
