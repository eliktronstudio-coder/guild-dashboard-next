import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

const MAX_IMAGE_BYTES = 800_000;
const MAX_PARTICIPANTS = 60;
const MAX_DROPS = 60;

function isAuthorized(request: NextRequest) {
  const secret = process.env.BOT_API_SECRET;
  if (!secret) return false;
  const header = request.headers.get("authorization");
  return header === `Bearer ${secret}`;
}

function normalizeName(name: string) {
  return name.trim().toLowerCase();
}

// Ники/названия предметов в игровом интерфейсе иногда обрезаны многоточием
// ("Konigzav...") — ИИ добросовестно переписывает то, что видно на скрине.
// Для таких случаев пробуем найти запись по началу строки, но только если
// подходит ровно одна — при неоднозначности лучше оставить для ручной проверки.
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

// Мелкий/стилизованный шрифт на скрине иногда сбивает распознавание пары
// букв (не обрезка, а именно опечатка). Ищем по близости строки — только
// если разница минимальна и подходит ровно одна запись, иначе слишком
// рискованно и лучше оставить для ручной проверки.
function fuzzyThreshold(len: number) {
  if (len < 4) return 0;
  if (len <= 5) return 1;
  if (len <= 10) return 2;
  return 3;
}

function matchByPrefix<T extends { id: string; name: string }>(raw: string, candidates: T[], usedIds: Set<string>) {
  const prefix = stripTruncationMark(raw);
  const normalizedPrefix = prefix ? normalizeName(prefix) : "";
  if (!prefix || normalizedPrefix.length < 2) return null;
  const found = candidates.filter((c) => !usedIds.has(c.id) && normalizeName(c.name).startsWith(normalizedPrefix));
  return found.length === 1 ? found[0] : null;
}

function matchByFuzzy<T extends { id: string; name: string }>(raw: string, candidates: T[], usedIds: Set<string>) {
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

// Три прохода одинаковой строгости для любого списка {id, name}: точное
// совпадение (без учёта регистра) -> обрезанное многоточием название ->
// опечатка на 1-3 буквы. На каждом шаге совпадение принимается, только
// если оно однозначно — иначе запись остаётся неопознанной для ручной проверки.
function matchNames<T extends { id: string; name: string }>(rawNames: string[], candidates: T[]) {
  const byExactName = new Map(candidates.map((c) => [normalizeName(c.name), c]));
  const matched: { input: string; item: T }[] = [];
  const usedIds = new Set<string>();
  const unmatched: string[] = [];

  for (const raw of rawNames) {
    const exact = byExactName.get(normalizeName(raw));
    if (exact && !usedIds.has(exact.id)) {
      matched.push({ input: raw, item: exact });
      usedIds.add(exact.id);
    } else {
      unmatched.push(raw);
    }
  }

  const afterPrefix: string[] = [];
  for (const raw of unmatched) {
    const found = matchByPrefix(raw, candidates, usedIds);
    if (found) {
      matched.push({ input: raw, item: found });
      usedIds.add(found.id);
    } else {
      afterPrefix.push(raw);
    }
  }

  const stillUnmatched: string[] = [];
  for (const raw of afterPrefix) {
    const found = matchByFuzzy(raw, candidates, usedIds);
    if (found) {
      matched.push({ input: raw, item: found });
      usedIds.add(found.id);
    } else {
      stillUnmatched.push(raw);
    }
  }

  return { matched, unmatched: stillUnmatched };
}

const CATEGORIES = ["Мини-РБ", "Прайм"];
const MODES = ["PvE", "PvP"];

// Тестовая интеграция с Discord-ботом: бот присылает название активности,
// список ников (со скрина ростера) и опционально список предметов (со
// скрина дропа), оба распознанных ИИ. Ники и предметы сверяются с составом
// гильдии / реестром дропа — совпавшее применяется, остальное уходит на
// ручную проверку (гости / ничего не создаётся), чтобы не приписать
// активность не тому игроку и не выдумать цену на неизвестный предмет.
export async function POST(request: NextRequest) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ error: "Нет доступа." }, { status: 403 });
  }

  const body = await request.json().catch(() => null);
  const name = typeof body?.name === "string" ? body.name.trim() : "";
  const category = typeof body?.category === "string" && CATEGORIES.includes(body.category) ? body.category : CATEGORIES[0];
  const mode = typeof body?.mode === "string" && MODES.includes(body.mode) ? body.mode : MODES[0];
  const screenshot = typeof body?.screenshot === "string" ? body.screenshot : "";
  const participantNames: string[] = Array.isArray(body?.participants)
    ? body.participants
        .filter((n: unknown): n is string => typeof n === "string")
        .map((n: string) => n.trim())
        .filter((n: string) => n.length > 0 && n.length <= 40)
    : [];
  const dropEntries: { name: string; quantity: number }[] = Array.isArray(body?.drops)
    ? body.drops
        .filter((d: unknown): d is { name: unknown; quantity: unknown } => typeof d === "object" && d !== null)
        .map((d: { name: unknown; quantity: unknown }) => ({
          name: typeof d.name === "string" ? d.name.trim() : "",
          quantity: Math.max(1, Math.round(Number(d.quantity) || 1)),
        }))
        .filter((d: { name: string; quantity: number }) => d.name.length > 0 && d.name.length <= 60)
    : [];

  if (!name || name.length > 60) {
    return NextResponse.json({ error: "Укажите название активности (до 60 символов)." }, { status: 400 });
  }
  if (participantNames.length > MAX_PARTICIPANTS) {
    return NextResponse.json({ error: `Слишком много участников (максимум ${MAX_PARTICIPANTS}).` }, { status: 400 });
  }
  if (dropEntries.length > MAX_DROPS) {
    return NextResponse.json({ error: `Слишком много предметов (максимум ${MAX_DROPS}).` }, { status: 400 });
  }
  if (screenshot && (!screenshot.startsWith("data:image/") || screenshot.length > MAX_IMAGE_BYTES)) {
    return NextResponse.json({ error: "Скрин слишком большой или неверного формата." }, { status: 400 });
  }

  const allPlayers = await prisma.player.findMany({ select: { id: true, name: true } });
  const players = matchNames(participantNames, allPlayers);

  const catalogItems = dropEntries.length
    ? await prisma.dropCatalogItem.findMany({ select: { id: true, name: true, price: true } })
    : [];
  const drops = matchNames(
    dropEntries.map((d) => d.name),
    catalogItems
  );
  const quantityByInput = new Map(dropEntries.map((d) => [d.name, d.quantity]));

  // Куда падает дроп: с Мини-РБ активности — сразу на склад ХД, с Прайм —
  // в Общий инвентарь (та же логика, что и в /api/drops при ручном добавлении).
  const warehouse = category === "Мини-РБ" ? "ХД" : "Общий";

  const activity = await prisma.activity.create({
    data: {
      name,
      category,
      mode,
      addedByUserId: null,
      participants: { create: players.matched.map((m) => ({ playerId: m.item.id })) },
      guests: { create: players.unmatched.map((n) => ({ name: n })) },
      screenshots: screenshot ? { create: [{ kind: "roster", imageUrl: screenshot }] } : undefined,
      drops: {
        create: drops.matched.map((m) => ({
          item: m.item.name,
          value: m.item.price,
          quantity: quantityByInput.get(m.input) ?? 1,
          catalogItemId: m.item.id,
          warehouse,
          category,
        })),
      },
    },
  });

  return NextResponse.json(
    {
      activity: { id: activity.id, name: activity.name, category: activity.category, mode: activity.mode },
      matched: players.matched.map((m) => ({ input: m.input, playerName: m.item.name })),
      unmatched: players.unmatched,
      drops: {
        matched: drops.matched.map((m) => ({ input: m.input, catalogName: m.item.name, quantity: quantityByInput.get(m.input) ?? 1 })),
        unmatched: drops.unmatched,
      },
    },
    { status: 201 }
  );
}
