import test, { before, after } from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

import { splitProportionally } from "../src/lib/proportionalSplit";
import { SCHEDULE } from "../src/lib/schedule";

/* ——— Пропорциональное деление ——— */

test("сумма долей всегда равна исходной", () => {
  const cases: { weights: number[]; total: number }[] = [
    { weights: [98, 90, 69, 67, 66], total: 1_000_000 },
    { weights: [1, 1, 1], total: 10 },
    { weights: [33, 33, 34], total: 7 },
    { weights: [5], total: 999 },
    { weights: [7, 3], total: 1 },
  ];
  for (const { weights, total } of cases) {
    const shares = splitProportionally(
      weights.map((w, i) => ({ item: i, weight: w })),
      total
    );
    const sum = shares.reduce((s, x) => s + x.amount, 0);
    assert.equal(sum, total, `веса ${weights.join("/")} на ${total} дали ${sum}`);
  }
});

test("нулевой вес и нулевая сумма не ломают деление", () => {
  const zeroWeights = splitProportionally([{ item: "a", weight: 0 }], 100);
  assert.equal(zeroWeights[0].amount, 0);

  const zeroTotal = splitProportionally([{ item: "a", weight: 5 }], 0);
  assert.equal(zeroTotal[0].amount, 0);
});

test("остаток достаётся тем, у кого дробная часть больше", () => {
  // 10 на веса 1/1/1 — по 3.33: трое получают 3, один лишний идёт первому.
  const shares = splitProportionally(
    [1, 1, 1].map((w, i) => ({ item: i, weight: w })),
    10
  );
  assert.deepEqual(shares.map((s) => s.amount).sort((a, b) => b - a), [4, 3, 3]);
});

/* ——— Расписание ——— */

test("Алтарь стоит в понедельник, среду, четверг, пятницу и субботу", () => {
  const altar = SCHEDULE.filter((s) => s.name === "Алтарь");
  const days = [...new Set(altar.map((s) => s.day))].sort();
  assert.deepEqual(days, [1, 3, 4, 5, 6]);
});

test("Алтарь идёт в 16:00 и 20:00, по два слота в день", () => {
  const altar = SCHEDULE.filter((s) => s.name === "Алтарь");
  assert.equal(altar.length, 10, "5 дней × 2 слота");
  const times = [...new Set(altar.map((s) => s.minutes))].sort((a, b) => a - b);
  assert.deepEqual(times, [16 * 60, 20 * 60]);
});

test("во вторник и воскресенье Алтаря нет", () => {
  const altar = SCHEDULE.filter((s) => s.name === "Алтарь");
  assert.equal(altar.some((s) => s.day === 2 || s.day === 0), false);
});

/* ——— Перераспределение выплат ——— */

let dir: string;
let prisma: typeof import("../src/lib/prisma").prisma;
let redistribute: typeof import("../src/lib/payoutRedistribution").redistributePlayerPayments;

before(async () => {
  dir = mkdtempSync(path.join(tmpdir(), "xd-payout-test-"));
  process.env.DATABASE_URL = `file:${path.join(dir, "test.db").replace(/\\/g, "/")}`;
  execFileSync("npx", ["prisma", "migrate", "deploy"], { cwd: process.cwd(), env: process.env, stdio: "pipe", shell: true });

  ({ prisma } = await import("../src/lib/prisma"));
  ({ redistributePlayerPayments: redistribute } = await import("../src/lib/payoutRedistribution"));
});

after(() => {
  try {
    rmSync(dir, { recursive: true, force: true });
  } catch {
    // временный каталог мог быть занят — на результат не влияет
  }
});

async function makePlayer(name: string) {
  return prisma.player.create({ data: { name, role: "Танк" } });
}

async function pay(playerId: string, amount: number, status = "Ожидает", archiveMonth: string | null = "2026-09") {
  return prisma.payment.create({ data: { playerId, amount, status, archiveMonth, source: "archive" } });
}

test("неоплаченное золото удаляемого игрока достаётся остальным", async () => {
  const [a, b, c] = await Promise.all([makePlayer("A1"), makePlayer("B1"), makePlayer("C1")]);
  await pay(a.id, 300);
  await pay(b.id, 200);
  await pay(c.id, 100);

  const before = 300 + 200 + 100;

  const result = await prisma.$transaction(async (tx) => {
    const r = await redistribute(tx, a.id);
    await tx.player.delete({ where: { id: a.id } });
    return r;
  });

  assert.equal(result.movedGold, 300);

  const rest = await prisma.payment.findMany({ where: { archiveMonth: "2026-09" } });
  const after = rest.reduce((s, p) => s + p.amount, 0);
  assert.equal(after, before, "общая сумма месяца не должна измениться");

  // 300 делится в пропорции 200:100 → 200 и 100.
  const byPlayer = new Map(rest.map((p) => [p.playerId, p.amount]));
  assert.equal(byPlayer.get(b.id), 400);
  assert.equal(byPlayer.get(c.id), 200);
});

test("уже выплаченное не перераспределяется", async () => {
  const [a, b] = await Promise.all([makePlayer("A2"), makePlayer("B2")]);
  await pay(a.id, 500, "Выплачено", "2026-08");
  await pay(b.id, 100, "Ожидает", "2026-08");

  const result = await prisma.$transaction(async (tx) => {
    const r = await redistribute(tx, a.id);
    await tx.player.delete({ where: { id: a.id } });
    return r;
  });

  assert.equal(result.movedGold, 0, "выплаченное золото ушло из гильдии, возвращать нечего");
  const left = await prisma.payment.findMany({ where: { archiveMonth: "2026-08" } });
  assert.equal(left.length, 1);
  assert.equal(left[0].amount, 100, "сумма получателя не должна вырасти");
});

test("месяцы не смешиваются", async () => {
  const [a, b, c] = await Promise.all([makePlayer("A3"), makePlayer("B3"), makePlayer("C3")]);
  await pay(a.id, 100, "Ожидает", "2026-06");
  await pay(b.id, 100, "Ожидает", "2026-06");
  await pay(c.id, 100, "Ожидает", "2026-07");

  await prisma.$transaction(async (tx) => {
    await redistribute(tx, a.id);
    await tx.player.delete({ where: { id: a.id } });
  });

  const june = await prisma.payment.findMany({ where: { archiveMonth: "2026-06" } });
  const july = await prisma.payment.findMany({ where: { archiveMonth: "2026-07" } });
  assert.equal(june[0].amount, 200, "июньские деньги ушли июньскому получателю");
  assert.equal(july[0].amount, 100, "июль трогать нельзя");
});

test("если раздать некому — сумма отмечается как оставшаяся в казне", async () => {
  const a = await makePlayer("A4");
  await pay(a.id, 250, "Ожидает", "2026-05");

  const result = await prisma.$transaction(async (tx) => {
    const r = await redistribute(tx, a.id);
    await tx.player.delete({ where: { id: a.id } });
    return r;
  });

  assert.equal(result.movedGold, 0);
  assert.equal(result.orphanedGold, 250);
  const left = await prisma.payment.findMany({ where: { archiveMonth: "2026-05" } });
  assert.equal(left.length, 0);
});

test("остаток от нацело неделимой суммы не теряется", async () => {
  const [a, b, c] = await Promise.all([makePlayer("A5"), makePlayer("B5"), makePlayer("C5")]);
  await pay(a.id, 10, "Ожидает", "2026-04");
  await pay(b.id, 3, "Ожидает", "2026-04");
  await pay(c.id, 3, "Ожидает", "2026-04");

  await prisma.$transaction(async (tx) => {
    await redistribute(tx, a.id);
    await tx.player.delete({ where: { id: a.id } });
  });

  const left = await prisma.payment.findMany({ where: { archiveMonth: "2026-04" } });
  const sum = left.reduce((s, p) => s + p.amount, 0);
  assert.equal(sum, 16, "10 разделить на 3:3 — сумма обязана остаться 16");
});

/* ——— До архивации: перерасчёт должен происходить сам ——— */

test("до архивации удаление игрока увеличивает доли остальных, а не теряет золото", async () => {
  const { getAllPlayers } = await import("../src/lib/queries");

  // Казна Мини-РБ: продажа дропа категории «Мини-РБ» на 1000 золота.
  const tx = await prisma.treasuryTransaction.create({
    data: { description: "Тестовая продажа", amount: 1000 },
  });
  await prisma.dropItem.create({
    data: { item: "Тест", quantity: 1, value: 1000, status: "Продано", category: "Мини-РБ", treasuryTransactionId: tx.id },
  });

  // Три игрока с одинаковой посещаемостью Мини-РБ: по одной активности.
  const players = await Promise.all([makePlayer("S1"), makePlayer("S2"), makePlayer("S3")]);
  await prisma.activity.create({
    data: {
      name: "Тестовый РБ",
      category: "Мини-РБ",
      participants: { create: players.map((p) => ({ playerId: p.id })) },
    },
  });

  const before = await getAllPlayers();
  const beforeSum = before.reduce((s, p) => s + p.salaryMiniRb, 0);
  assert.ok(beforeSum > 0, "зарплата должна была посчитаться");

  await prisma.player.delete({ where: { id: players[0].id } });

  const after = await getAllPlayers();
  const afterSum = after.reduce((s, p) => s + p.salaryMiniRb, 0);

  // Пул казны не изменился, значит и общая сумма к выплате осталась той же —
  // доля удалённого просто перешла остальным.
  assert.equal(afterSum, beforeSum, "золото удалённого игрока не должно пропадать");

  const survivor = after.find((p) => p.id === players[1].id);
  const survivorBefore = before.find((p) => p.id === players[1].id);
  assert.ok(
    survivor!.salaryMiniRb > survivorBefore!.salaryMiniRb,
    "доля оставшегося игрока должна вырасти"
  );
});

test("доля игрока ниже порога уходит остальным, а не пропадает", async () => {
  const { getAllPlayers } = await import("../src/lib/queries");

  const tx = await prisma.treasuryTransaction.create({
    data: { description: "Порог", amount: 900 },
  });
  await prisma.dropItem.create({
    data: { item: "Порог", quantity: 1, value: 900, status: "Продано", category: "Мини-РБ", treasuryTransactionId: tx.id },
  });

  // Двое ходят на все активности, третий — на одну из десяти (10% < 20%).
  const [a, b, low] = await Promise.all([makePlayer("T1"), makePlayer("T2"), makePlayer("T3")]);
  for (let i = 0; i < 10; i++) {
    await prisma.activity.create({
      data: {
        name: `РБ ${i}`,
        category: "Мини-РБ",
        participants: { create: i === 0 ? [a, b, low].map((p) => ({ playerId: p.id })) : [a, b].map((p) => ({ playerId: p.id })) },
      },
    });
  }

  const players = await getAllPlayers();
  const lowPlayer = players.find((p) => p.id === low.id)!;
  assert.equal(lowPlayer.salaryMiniRb, 0, "игрок ниже порога не получает долю");

  const sum = players.reduce((s, p) => s + p.salaryMiniRb, 0);
  // Весь пул обязан быть роздан оставшимся двоим — ничего не оседает.
  assert.ok(sum > 0, "пул должен быть распределён");
  const { getTreasuryBreakdown } = await import("../src/lib/queries");
  const br = await getTreasuryBreakdown();
  assert.equal(sum, br.miniRb, "сумма долей обязана совпадать с казной Мини-РБ");
});
