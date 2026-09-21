import test, { before, after } from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

import { computePeriodBounds } from "../src/lib/period";

/* ——— Границы цикла 15→15 ——— */

test("цикл содержит переданную дату, а не начинается после неё", () => {
  // 16 сентября — середина цикла 15.09 → 15.10.
  const mid = computePeriodBounds(new Date(2026, 8, 16));
  assert.equal(mid.startDate.getMonth(), 8, "сентябрь");
  assert.equal(mid.startDate.getDate(), 15);
  assert.equal(mid.endDate.getMonth(), 9, "октябрь");

  // 14 сентября — ещё предыдущий цикл, 15.08 → 15.09.
  const early = computePeriodBounds(new Date(2026, 8, 14));
  assert.equal(early.startDate.getMonth(), 7, "август");
  assert.equal(early.endDate.getMonth(), 8, "сентябрь");

  // Ровно 15-е — начало нового цикла.
  const edge = computePeriodBounds(new Date(2026, 8, 15));
  assert.equal(edge.startDate.getMonth(), 8);
  assert.equal(edge.startDate.getDate(), 15);
});

test("цикл переходит через новый год", () => {
  const dec = computePeriodBounds(new Date(2026, 11, 20));
  assert.equal(dec.startDate.getFullYear(), 2026);
  assert.equal(dec.endDate.getFullYear(), 2027);
  assert.equal(dec.endDate.getMonth(), 0, "январь");
});

test("границы всегда охватывают саму дату", () => {
  // Регрессия на первопричину: удалённая кнопка закрытия считала следующий
  // период от endDate текущего — computePeriodBounds(endDate) даёт цикл,
  // который НАЧИНАЕТСЯ в этот день, то есть целиком в будущем.
  for (let day = 1; day <= 28; day++) {
    for (let month = 0; month < 12; month++) {
      const d = new Date(2026, month, day, 12);
      const { startDate, endDate } = computePeriodBounds(d);
      assert.ok(startDate <= d, `${d.toDateString()}: начало не должно быть позже даты`);
      assert.ok(endDate > d, `${d.toDateString()}: конец должен быть после даты`);
    }
  }
});

/* ——— Самопочинка испорченного периода ——— */

let dir: string;
let prisma: typeof import("../src/lib/prisma").prisma;
let getActivePeriod: typeof import("../src/lib/period").getActivePeriod;

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
  ({ getActivePeriod } = await import("../src/lib/period"));
});

after(() => {
  try {
    rmSync(dir, { recursive: true, force: true });
  } catch {
    // каталог мог быть занят — на результат тестов не влияет
  }
});

async function reset() {
  await prisma.activity.deleteMany({});
  await prisma.accountingPeriod.deleteMany({});
}

/** Период, который начнётся только через месяц — ровно то, что осталось в боевой базе. */
function futureBounds() {
  const now = new Date();
  const startDate = new Date(now.getFullYear(), now.getMonth() + 1, 15);
  const endDate = new Date(now.getFullYear(), now.getMonth() + 2, 15);
  return { startDate, endDate };
}

test("период из будущего чинится на месте, а не подменяется новым", async () => {
  await reset();
  const { startDate, endDate } = futureBounds();
  const broken = await prisma.accountingPeriod.create({
    data: { startDate, endDate, label: "будущий", status: "active" },
  });

  const active = await getActivePeriod();

  // Тот же id: к периоду привязаны активности, и подмена обнулила бы
  // посещаемость всей гильдии.
  assert.equal(active.id, broken.id, "период должен быть исправлен, а не заменён");

  const now = new Date();
  assert.ok(active.startDate <= now, "начало периода не может быть в будущем");
  assert.ok(active.endDate > now, "конец периода должен быть впереди");
  assert.equal(active.status, "active");

  assert.equal(await prisma.accountingPeriod.count(), 1, "лишних периодов появиться не должно");
});

test("починка сохраняет привязанные активности", async () => {
  await reset();
  const { startDate, endDate } = futureBounds();
  const broken = await prisma.accountingPeriod.create({
    data: { startDate, endDate, label: "будущий", status: "active" },
  });
  await prisma.activity.create({ data: { name: "Кракен", category: "Прайм", periodId: broken.id } });

  const active = await getActivePeriod();
  const activities = await prisma.activity.findMany({ where: { periodId: active.id } });
  assert.equal(activities.length, 1, "активность обязана остаться в активном периоде");
});

test("нормальный текущий период не трогается", async () => {
  await reset();
  const first = await getActivePeriod();
  const again = await getActivePeriod();

  assert.equal(again.id, first.id, "повторный вызов не должен создавать новый период");
  assert.equal(await prisma.accountingPeriod.count(), 1);
  assert.equal(again.label, first.label, "подпись не должна переписываться на ровном месте");
});

test("из нескольких активных выбирается тот, внутри которого мы сейчас", async () => {
  await reset();
  const correct = await getActivePeriod();

  // Лишний активный период в будущем — сортировка по startDate desc выбрала бы
  // именно его, и весь учёт уехал бы туда.
  const { startDate, endDate } = futureBounds();
  await prisma.accountingPeriod.create({
    data: { startDate, endDate, label: "лишний будущий", status: "active" },
  });

  const active = await getActivePeriod();
  assert.equal(active.id, correct.id, "должен остаться период, содержащий сегодняшний день");
});
