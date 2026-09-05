/**
 * Подбор записи по названию, устойчивый к тому, как названия приходят из игры:
 * другой регистр, обрезка многоточием, опечатка в пару букв после распознавания
 * скрина. Используется и для ников участников, и для баннеров активностей.
 */

export type Named = { id: string; name: string };

export function normalizeName(name: string) {
  return name.trim().toLowerCase();
}

/**
 * Названия в игровом интерфейсе иногда обрезаны многоточием ("Konigzav...") —
 * ИИ добросовестно переписывает то, что видно на скрине.
 */
function stripTruncationMark(name: string) {
  const match = name.match(/^(.*?)(?:\.{3,}|…)$/);
  return match ? match[1].trim() : null;
}

function levenshtein(a: string, b: string) {
  const dp: number[] = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    let prevDiag = dp[0];
    dp[0] = i;
    for (let j = 1; j <= b.length; j++) {
      const temp = dp[j];
      dp[j] = a[i - 1] === b[j - 1] ? prevDiag : 1 + Math.min(prevDiag, dp[j], dp[j - 1]);
      prevDiag = temp;
    }
  }
  return dp[b.length];
}

/**
 * Мелкий/стилизованный шрифт на скрине сбивает распознавание пары букв — это
 * не обрезка, а именно опечатка. Порог намеренно узкий: совпадение принимается,
 * только если оно однозначно.
 */
function fuzzyThreshold(len: number) {
  if (len < 4) return 0;
  if (len <= 5) return 1;
  if (len <= 10) return 2;
  return 3;
}

function matchExact<T extends Named>(raw: string, candidates: T[], usedIds: Set<string>) {
  const normalized = normalizeName(raw);
  return candidates.find((c) => !usedIds.has(c.id) && normalizeName(c.name) === normalized) ?? null;
}

function matchByPrefix<T extends Named>(raw: string, candidates: T[], usedIds: Set<string>) {
  const prefix = stripTruncationMark(raw);
  const normalizedPrefix = prefix ? normalizeName(prefix) : "";
  if (!prefix || normalizedPrefix.length < 2) return null;
  const found = candidates.filter((c) => !usedIds.has(c.id) && normalizeName(c.name).startsWith(normalizedPrefix));
  return found.length === 1 ? found[0] : null;
}

function matchByFuzzy<T extends Named>(raw: string, candidates: T[], usedIds: Set<string>) {
  const normalized = normalizeName(raw);
  const threshold = fuzzyThreshold(normalized.length);
  if (threshold === 0) return null;
  let best: { item: T; distance: number } | null = null;
  let unique = true;
  for (const candidate of candidates) {
    if (usedIds.has(candidate.id)) continue;
    const distance = levenshtein(normalized, normalizeName(candidate.name));
    if (distance > threshold) continue;
    if (!best || distance < best.distance) {
      best = { item: candidate, distance };
      unique = true;
    } else if (distance === best.distance) {
      unique = false;
    }
  }
  return best && unique ? best.item : null;
}

/**
 * Точное совпадение -> обрезанное многоточием -> опечатка на 1-3 буквы.
 * На каждом шаге совпадение принимается, только если оно однозначно.
 */
export function findBestMatch<T extends Named>(raw: string, candidates: T[], usedIds: Set<string> = new Set()) {
  return (
    matchExact(raw, candidates, usedIds) ??
    matchByPrefix(raw, candidates, usedIds) ??
    matchByFuzzy(raw, candidates, usedIds)
  );
}

/**
 * Похожие варианты, когда findBestMatch не смог однозначно определить ник
 * (скрин распознан плохо, опечатка больше обычного порога, или несколько
 * кандидатов совпали с одинаковой опечаткой). Порог шире, чем в
 * matchByFuzzy, — тут не автопринятие, а подсказка человеку на выбор.
 */
export function findCandidates<T extends Named>(raw: string, candidates: T[], limit = 5): T[] {
  const normalized = normalizeName(raw);
  if (!normalized) return [];
  const threshold = Math.max(2, fuzzyThreshold(normalized.length) + 2);
  return candidates
    .map((c) => ({ item: c, distance: levenshtein(normalized, normalizeName(c.name)) }))
    .filter((c) => c.distance <= threshold)
    .sort((a, b) => a.distance - b.distance)
    .slice(0, limit)
    .map((c) => c.item);
}

/**
 * Сопоставляет список названий со списком записей. Каждая запись занимается
 * не более одного раза — один игрок не может дважды попасть в один ростер.
 */
export function matchNames<T extends Named>(rawNames: string[], candidates: T[]) {
  const matched: { input: string; item: T }[] = [];
  const unmatched: string[] = [];
  const usedIds = new Set<string>();

  // Проходы идут по всему списку по очереди, а не по одному названию: точное
  // совпадение должно занять запись раньше, чем её заберёт чужая опечатка.
  let pending = [...rawNames];
  for (const pass of [matchExact, matchByPrefix, matchByFuzzy]) {
    const rest: string[] = [];
    for (const raw of pending) {
      const found = pass(raw, candidates, usedIds);
      if (found) {
        matched.push({ input: raw, item: found });
        usedIds.add(found.id);
      } else {
        rest.push(raw);
      }
    }
    pending = rest;
  }
  unmatched.push(...pending);

  return { matched, unmatched };
}

/**
 * Ищет запись, чьё название встречается в искомом как отдельное слово:
 * активности из игры называются длиннее баннера («АГЛ Т1» -> «АГЛ»,
 * «Кошка (утро)» -> «Кошка», «Разъяренный Морфеос» -> «Морфеос»). Границы
 * слова обязательны, иначе «Скуф» цеплялся бы к «Скуфище». Из нескольких
 * подходящих берётся самое длинное название.
 */
function matchAsWordInRaw<T extends Named>(raw: string, candidates: T[]) {
  const normalized = normalizeName(raw);
  const isWordChar = (ch: string | undefined) => ch !== undefined && /[\p{L}\p{N}]/u.test(ch);
  const hits = candidates.filter((c) => {
    const name = normalizeName(c.name);
    if (!name) return false;
    let from = 0;
    for (;;) {
      const at = normalized.indexOf(name, from);
      if (at < 0) return false;
      if (!isWordChar(normalized[at - 1]) && !isWordChar(normalized[at + name.length])) return true;
      from = at + 1;
    }
  });
  if (hits.length === 0) return null;
  const longest = Math.max(...hits.map((h) => normalizeName(h.name).length));
  const best = hits.filter((h) => normalizeName(h.name).length === longest);
  return best.length === 1 ? best[0] : null;
}

/**
 * Подбор для случаев, где искомое название может быть длиннее записи —
 * баннеры активностей. Для ников не используется: там «Скуфище» не должен
 * находить «Скуф».
 */
export function findLabelMatch<T extends Named>(raw: string, candidates: T[]) {
  return findBestMatch(raw, candidates) ?? matchAsWordInRaw(raw, candidates);
}
