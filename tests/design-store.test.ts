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

/** Общий + страничный CSS одной строкой — тесты проверяют итоговый текст. */
function cssText(css: { shared: string; page: string }) {
  return css.shared + css.page;
}

const redPanel = {
  schemaVersion: 2,
  elements: { "home.myChart": { color: { base: { normal: "#ff0000" } } } },
  tokens: { dark: {}, light: {} },
};

const bluePanel = {
  schemaVersion: 2,
  elements: { "shared.panel": { borderRadius: { base: { normal: "20px" } } } },
  tokens: { dark: {}, light: {} },
};

test("черновик сохраняется и читается обратно", async () => {
  await store.saveDraft("home", redPanel as never, "admin");
  const state = await store.getDesignState("home");
  assert.equal(state.draft.elements["home.myChart"].color?.base?.normal, "#ff0000");
  assert.equal(state.hasUnpublished, true, "черновик должен отличаться от публикации");
});

test("до публикации посетители видят пустое оформление", async () => {
  const css = cssText(await store.getPublishedCss("home"));
  assert.equal(css, "", "черновик не должен попадать в публичный CSS");
});

test("публикация одной страницы не публикует черновики других", async () => {
  await store.saveDraft("players", bluePanel as never, "admin");

  const before = await store.getDesignState("home");
  const result = await store.publishPage("home", "admin", before.revision, "тест");
  assert.equal(result.ok, true);

  const homeCss = cssText(await store.getPublishedCss("home"));
  assert.match(homeCss, /\[data-design-page="home"\]/, "оформление Главной должно быть опубликовано");

  const playersCss = cssText(await store.getPublishedCss("players"));
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
  const publishedBefore = cssText(await store.getPublishedCss("home"));
  const restored = await store.restoreVersionToDraft("home", history[history.length - 1].id, "admin");
  assert.equal(restored, true);

  const after = await store.getDesignState("home");
  assert.equal(after.draft.elements["home.myChart"].color?.base?.normal, "#ff0000");
  assert.equal(cssText(await store.getPublishedCss("home")), publishedBefore, "публикация не должна меняться при восстановлении");
});

test("общие настройки попадают в CSS любой страницы", async () => {
  const sharedConfig = {
    schemaVersion: 2,
    elements: { "shared.sidebar": { backgroundColor: { base: { normal: "#101010" } } } },
    tokens: { dark: { accent: "#00ff00" }, light: { accent: "#0000ff" } },
  };
  const sharedState = await store.getDesignState("__shared__");
  await store.saveDraft("__shared__", sharedConfig as never, "admin");
  await store.publishPage("__shared__", "admin", sharedState.revision, "тема");

  const css = cssText(await store.getPublishedCss("players"));
  assert.match(css, /:root\{--accent: #00ff00\}/);
  assert.match(css, /:root\[data-theme="light"\]\{--accent: #0000ff\}/);
  assert.match(css, /\[data-design-el="shared\.sidebar"\]/);
});

test("подписи и блоки отдаются для рендера только после публикации", async () => {
  const withContent = {
    schemaVersion: 2,
    elements: {},
    tokens: { dark: {}, light: {} },
    texts: { "home.titleSchedule": "Ближайшее" },
    blocks: { top: [{ id: "blk1", type: "heading", text: "Объявление" }], bottom: [] },
  };
  await store.saveDraft("home", withContent as never, "admin");

  // Черновик не должен просачиваться в публичный рендер.
  const published = await store.getPublishedContent("home");
  assert.equal(published.texts["home.titleSchedule"], undefined);
  assert.equal((published.blocks.top ?? []).length, 0);

  // В предпросмотре черновика — виден.
  const draft = await store.getDraftContent("home", false);
  assert.equal(draft.texts["home.titleSchedule"], "Ближайшее");
  assert.equal(draft.blocks.top?.[0].text, "Объявление");

  const state = await store.getDesignState("home");
  await store.publishPage("home", "admin", state.revision, "с блоком");

  const after = await store.getPublishedContent("home");
  assert.equal(after.texts["home.titleSchedule"], "Ближайшее");
  assert.equal(after.blocks.top?.[0].text, "Объявление");
});

test("используемый медиафайл считается занятым, свободный — нет", async () => {
  const mediaId = "abcdefghijklmnopqrst";
  const config = {
    schemaVersion: 2,
    elements: { "players.__none": {} },
    tokens: { dark: {}, light: {} },
    blocks: { top: [{ id: "img1", type: "image", mediaId }], bottom: [] },
  };
  await store.saveDraft("players", config as never, "admin");

  const usage = await store.findMediaUsage(mediaId);
  assert.ok(usage.length > 0, "файл в черновике должен считаться используемым");
  assert.ok(usage.some((u) => u.includes("черновик")), `ожидалась отметка о черновике, получено: ${usage.join(", ")}`);

  const free = await store.findMediaUsage("zzzzzzzzzzzzzzzzzzzz");
  assert.deepEqual(free, [], "неиспользуемый файл должен быть свободен");
});

test("неизвестный ключ страницы отвергается", async () => {
  await assert.rejects(() => store.getDesignState("не-существует"));
});
