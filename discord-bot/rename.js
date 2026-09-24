/**
 * Разбор сообщений канала ренеймов: «СтарыйНик - НовыйНик».
 *
 * Отдельным модулем от index.js, чтобы разбор можно было проверить тестами:
 * именно здесь раньше молча терялись ники с пробелами.
 */

/** Должно совпадать с /api/bot/players/rename. */
const MAX_NICK = 40;

// Стрелку можно окружать чем угодно — она сама по себе однозначна.
const ARROW_RE = /^(.+?)\s*(?:->|=>|→|–|—)\s*(.+)$/;

// Простой дефис считается разделителем, только если хотя бы с одной стороны
// от него есть пробел. Иначе «кто-нибудь тут?» было бы принято за
// переименование. Раньше требовалось по одному слову с каждой стороны, и
// ники с пробелами («Крячка инактив») молча не разбирались вовсе.
const HYPHEN_RE = /^(.+?)(?:\s+-\s*|\s*-\s+)(.+)$/;

/** Разбирает одну строку. null — строка не похожа на переименование. */
function parseRename(line) {
  const text = String(line ?? "").trim();
  if (!text) return null;

  const match = text.match(ARROW_RE) || text.match(HYPHEN_RE);
  if (!match) return null;

  const from = match[1].trim();
  const to = match[2].trim();
  if (!from || !to) return null;
  if (from.length > MAX_NICK || to.length > MAX_NICK) return null;
  return { from, to };
}

/** Одно сообщение может содержать несколько переименований — по одному на строку. */
function parseRenames(content) {
  return String(content ?? "")
    .split("\n")
    .map(parseRename)
    .filter(Boolean);
}

/**
 * Похоже ли сообщение на попытку переименования: есть разделитель, но разбор
 * не удался. Нужно, чтобы подсказка не сыпалась на обычную болтовню в канале.
 */
function looksLikeRenameAttempt(content) {
  return /(?:->|=>|→|–|—|-)/.test(String(content ?? ""));
}

module.exports = { parseRename, parseRenames, looksLikeRenameAttempt, MAX_NICK };
