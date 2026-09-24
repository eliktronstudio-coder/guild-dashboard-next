import test from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";

// Бот — CommonJS, поэтому подключаем через require.
const require_ = createRequire(import.meta.url);
const { parseRename, parseRenames, MAX_NICK } = require_("../discord-bot/rename.js") as {
  parseRename: (line: string) => { from: string; to: string } | null;
  parseRenames: (content: string) => { from: string; to: string }[];
  MAX_NICK: number;
};

test("ник с пробелом разбирается", () => {
  // Ровно то сообщение, на которое бот молчал: игрок «Крячка инактив»
  // существует в составе, но прежний разбор требовал одно слово с каждой
  // стороны и такую строку не видел вовсе.
  assert.deepEqual(parseRename("Крячка инактив- Abandonment"), {
    from: "Крячка инактив",
    to: "Abandonment",
  });
  assert.deepEqual(parseRename("Старый Ник - Новый Ник"), { from: "Старый Ник", to: "Новый Ник" });
  assert.deepEqual(parseRename("Один - Два Три"), { from: "Один", to: "Два Три" });
});

test("прежние рабочие формы продолжают работать", () => {
  assert.deepEqual(parseRename("Кенвуд- Хренозавр"), { from: "Кенвуд", to: "Хренозавр" });
  assert.deepEqual(parseRename("Сынчерныхкоролев -> Ikq"), { from: "Сынчерныхкоролев", to: "Ikq" });
  assert.deepEqual(parseRename("А => Б"), { from: "А", to: "Б" });
  assert.deepEqual(parseRename("А → Б"), { from: "А", to: "Б" });
  assert.deepEqual(parseRename("  А  -  Б  "), { from: "А", to: "Б" }, "лишние пробелы обрезаются");
});

test("обычная фраза не принимается за переименование", () => {
  // Дефис без пробелов — часть слова, а не разделитель.
  assert.equal(parseRename("кто-нибудь тут?"), null);
  assert.equal(parseRename("что-то не так"), null);
  assert.equal(parseRename("привет"), null);
  assert.equal(parseRename(""), null);
  assert.equal(parseRename("   "), null);
});

test("пустая половина отбрасывается", () => {
  assert.equal(parseRename("- Новый"), null, "старого ника нет");
  assert.equal(parseRename("Старый -"), null, "нового ника нет");
  assert.equal(parseRename("->"), null);
});

test("слишком длинные ники отбрасываются", () => {
  const long = "я".repeat(MAX_NICK + 1);
  assert.equal(parseRename(`${long} - Б`), null);
  assert.equal(parseRename(`А - ${long}`), null);

  const edge = "я".repeat(MAX_NICK);
  assert.deepEqual(parseRename(`${edge} - Б`), { from: edge, to: "Б" }, "ровно по границе — принимаем");
});

test("несколько переименований в одном сообщении", () => {
  const pairs = parseRenames("Крячка инактив - Abandonment\nКенвуд- Хренозавр\nпросто болтовня\nА -> Б");
  assert.deepEqual(pairs, [
    { from: "Крячка инактив", to: "Abandonment" },
    { from: "Кенвуд", to: "Хренозавр" },
    { from: "А", to: "Б" },
  ]);
});

test("сообщение без единого переименования даёт пустой список", () => {
  // Бот подскажет формат, только если в строке был разделитель (см. ниже).
  assert.deepEqual(parseRenames("всем привет\nкак дела?"), []);
  assert.deepEqual(parseRenames(""), []);
});

/* ——— Когда подсказывать формат ——— */

const { looksLikeRenameAttempt } = require_("../discord-bot/rename.js") as {
  looksLikeRenameAttempt: (content: string) => boolean;
};

test("подсказка даётся только там, где человек явно пытался переименовать", () => {
  // Разделитель есть, но разбор не удался — тут подсказка уместна.
  assert.equal(looksLikeRenameAttempt("А-Б"), true, "дефис без пробелов");
  assert.equal(looksLikeRenameAttempt("Старый ->"), true, "пустая половина");
  assert.equal(looksLikeRenameAttempt("- Новый"), true);

  // Обычная болтовня в канале — бот молчит, а не сыплет подсказками.
  assert.equal(looksLikeRenameAttempt("всем привет"), false);
  assert.equal(looksLikeRenameAttempt("когда рейд?"), false);
  assert.equal(looksLikeRenameAttempt(""), false);
});
