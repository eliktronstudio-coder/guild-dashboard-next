import test, { before, after } from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

/**
 * Правка состава активности через диф, а не "удалить всё и создать заново".
 *
 * Это регрессия, найденная при добавлении достижений: полное удаление строк
 * ActivityParticipant при каждой правке ростера стирало бы отметку «полное
 * участие» у всех, кто остался в составе, — даже если сам он не менялся.
 */

let dir: string;
let prisma: typeof import("../src/lib/prisma").prisma;
let roster: typeof import("../src/lib/activityRoster");

before(async () => {
  dir = mkdtempSync(path.join(tmpdir(), "xd-roster-"));
  process.env.DATABASE_URL = `file:${path.join(dir, "test.db").split(path.sep).join("/")}`;

  execFileSync("npx", ["prisma", "migrate", "deploy"], {
    cwd: process.cwd(),
    env: process.env,
    stdio: "pipe",
    shell: true,
  });

  ({ prisma } = await import("../src/lib/prisma"));
  roster = await import("../src/lib/activityRoster");
});

after(() => {
  try {
    rmSync(dir, { recursive: true, force: true });
  } catch {
    // каталог мог быть занят — на результат тестов не влияет
  }
});

async function reset() {
  await prisma.activityParticipant.deleteMany({});
  await prisma.activity.deleteMany({});
  await prisma.player.deleteMany({});
}

test("правка состава не сбрасывает fullParticipation у оставшихся игроков", async () => {
  await reset();
  const [a, b, c] = await Promise.all([
    prisma.player.create({ data: { name: "А", role: "ДД" } }),
    prisma.player.create({ data: { name: "Б", role: "ДД" } }),
    prisma.player.create({ data: { name: "В", role: "ДД" } }),
  ]);
  const activity = await prisma.activity.create({
    data: { name: "Рейд", category: "Прайм", participants: { create: [{ playerId: a.id, fullParticipation: true }, { playerId: b.id }] } },
  });

  // Админ добавляет третьего игрока — А и Б остаются в составе без изменений.
  await prisma.$transaction((tx) => roster.applyRosterDiff(tx, activity.id, [a.id, b.id, c.id]));

  const parts = await prisma.activityParticipant.findMany({ where: { activityId: activity.id } });
  const byPlayer = new Map(parts.map((p) => [p.playerId, p]));
  assert.equal(byPlayer.get(a.id)!.fullParticipation, true, "отметка не должна была слететь");
  assert.equal(byPlayer.get(b.id)!.fullParticipation, false);
  assert.ok(byPlayer.has(c.id), "новый участник добавлен");
  assert.equal(parts.length, 3);
});

test("удаление игрока из состава удаляет только его строку", async () => {
  await reset();
  const [a, b] = await Promise.all([
    prisma.player.create({ data: { name: "А", role: "ДД" } }),
    prisma.player.create({ data: { name: "Б", role: "ДД" } }),
  ]);
  const activity = await prisma.activity.create({
    data: { name: "Рейд", category: "Прайм", participants: { create: [{ playerId: a.id, fullParticipation: true }, { playerId: b.id }] } },
  });

  await prisma.$transaction((tx) => roster.applyRosterDiff(tx, activity.id, [a.id]));

  const parts = await prisma.activityParticipant.findMany({ where: { activityId: activity.id } });
  assert.equal(parts.length, 1);
  assert.equal(parts[0].playerId, a.id);
  assert.equal(parts[0].fullParticipation, true, "оставшийся сохранил отметку");
});

test("applyRosterDiff сообщает, кто добавлен, удалён и остался", async () => {
  await reset();
  const [a, b, c] = await Promise.all([
    prisma.player.create({ data: { name: "А", role: "ДД" } }),
    prisma.player.create({ data: { name: "Б", role: "ДД" } }),
    prisma.player.create({ data: { name: "В", role: "ДД" } }),
  ]);
  const activity = await prisma.activity.create({
    data: { name: "Рейд", category: "Прайм", participants: { create: [{ playerId: a.id }, { playerId: b.id }] } },
  });

  const result = await prisma.$transaction((tx) => roster.applyRosterDiff(tx, activity.id, [b.id, c.id]));
  assert.deepEqual(result.added, [c.id]);
  assert.deepEqual(result.removed, [a.id]);
  assert.deepEqual(result.kept, [b.id]);
});

test("applyFullParticipation отмечает ровно указанных, остальным снимает", async () => {
  await reset();
  const [a, b] = await Promise.all([
    prisma.player.create({ data: { name: "А", role: "ДД" } }),
    prisma.player.create({ data: { name: "Б", role: "ДД" } }),
  ]);
  const activity = await prisma.activity.create({
    data: { name: "Рейд", category: "Прайм", participants: { create: [{ playerId: a.id, fullParticipation: true }, { playerId: b.id }] } },
  });

  await prisma.$transaction((tx) => roster.applyFullParticipation(tx, activity.id, [b.id]));

  const parts = await prisma.activityParticipant.findMany({ where: { activityId: activity.id } });
  const byPlayer = new Map(parts.map((p) => [p.playerId, p.fullParticipation]));
  assert.equal(byPlayer.get(a.id), false, "снято, раз его больше нет в списке");
  assert.equal(byPlayer.get(b.id), true);
});
