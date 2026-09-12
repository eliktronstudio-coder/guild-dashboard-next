import test, { before, after } from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

/**
 * Проверки хранилища оформления на отдельной временной базе: рабочая
 * dev.db не затрагивается.
 */

let dir: string;
let store: typeof import("../src/lib/design/store");

before(async () => {
  dir = mkdtempSync(path.join(tmpdir(), "xd-design-test-"));
  const dbPath = path.join(dir, "test.db").replace(/\\/g, "/");
  process.env.DATABASE_URL = `file:${dbPath}`;

  execFileSync("npx", ["prisma", "migrate", "deploy"], {
    cwd: process.cwd(),
    env: process.env,
    stdio: "pipe",
    shell: true,
  });

  store = await import("../src/lib/design/store");
});

after(() => {
  try {
    rmSync(dir, { recursive: true, force: true });
  } catch {
    // временный каталог мог быть занят — не влияет на результат тестов
  }
});

const redPanel = {
  schemaVersion: 1,
  elements: { "home.myChart": { color: { base: { normal: "#ff0000" } } } },
  tokens: {},
};

const bluePanel = {
  schemaVersion: 1,
  elements: { "shared.panel": { borderRadius: { base: { normal: "20px" } } } },
  tokens: {},
};

test("черновик сохраняется и читается обратно", async () => {
  await store.saveDraft("home", redPanel as never, "admin");
  const state = await store.getDesignState("home");
  assert.equal(state.draft.elements["home.myChart"].color?.base?.normal, "#ff0000");
  assert.equal(state.hasUnpublished, true, "черновик должен отличаться от публикации");
});

test("до публикации посетители видят пустое оформление", async () => {
  const css = await store.getPublishedCss("home");
  assert.equal(css, "", "черновик не должен попадать в публичный CSS");
});

test("публикация одной страницы не публикует черновики других", async () => {
  await store.saveDraft("players", bluePanel as never, "admin");

  const before = await store.getDesignState("home");
  const result = await store.publishPage("home", "admin", before.revision, "тест");
  assert.equal(result.ok, true);

  const homeCss = await store.getPublishedCss("home");
  assert.match(homeCss, /\[data-design-page="home"\]/, "оформление Главной должно быть опубликовано");

  const playersCss = await store.getPublishedCss("players");
  assert.equal(playersCss, "", "черновик Состава не должен был опубликоваться");

  const playersState = await store.getDesignState("players");
  assert.equal(playersState.hasUnpublished, true, "у Состава остаются неопубликованные изменения");
});

test("повторная публикация с устаревшей версией отклоняется", async () => {
  const state = await store.getDesignState("home");
  const stale = state.revision - 1;
  const result = await store.publishPage("home", "other-admin", stale, "конфликт");
  assert.equal(result.ok, false);
  if (!result.ok) assert.equal(result.reason, "conflict");
});

test("откат возвращает черновик к опубликованной версии", async () => {
  await store.saveDraft("home", bluePanel as never, "admin");
  let state = await store.getDesignState("home");
  assert.equal(state.hasUnpublished, true);

  await store.revertDraft("home", "admin");
  state = await store.getDesignState("home");
  assert.equal(state.hasUnpublished, false);
  assert.equal(state.draft.elements["home.myChart"].color?.base?.normal, "#ff0000");
});

test("история ведётся по страницам и восстановление не публикуется само", async () => {
  // Вторая публикация Главной, чтобы в истории стало две записи.
  const state = await store.getDesignState("home");
  await store.saveDraft("home", bluePanel as never, "admin");
  await store.publishPage("home", "admin", state.revision, "вторая версия");

  const history = await store.getHistory("home");
  assert.equal(history.length, 2, "в истории Главной должно быть две публикации");

  const playersHistory = await store.getHistory("players");
  assert.equal(playersHistory.length, 0, "у Состава публикаций не было");

  // Восстанавливаем самую старую версию — она должна попасть в черновик,
  // а опубликованная версия остаться прежней.
  const publishedBefore = await store.getPublishedCss("home");
  const restored = await store.restoreVersionToDraft("home", history[history.length - 1].id, "admin");
  assert.equal(restored, true);

  const after = await store.getDesignState("home");
  assert.equal(after.draft.elements["home.myChart"].color?.base?.normal, "#ff0000");
  assert.equal(await store.getPublishedCss("home"), publishedBefore, "публикация не должна меняться при восстановлении");
});

test("общие настройки попадают в CSS любой страницы", async () => {
  const sharedConfig = {
    schemaVersion: 1,
    elements: { "shared.sidebar": { backgroundColor: { base: { normal: "#101010" } } } },
    tokens: { accent: "#00ff00" },
  };
  const sharedState = await store.getDesignState("__shared__");
  await store.saveDraft("__shared__", sharedConfig as never, "admin");
  await store.publishPage("__shared__", "admin", sharedState.revision, "тема");

  const css = await store.getPublishedCss("players");
  assert.match(css, /--accent: #00ff00/);
  assert.match(css, /\[data-design-el="shared\.sidebar"\]/);
});

test("неизвестный ключ страницы отвергается", async () => {
  await assert.rejects(() => store.getDesignState("не-существует"));
});
