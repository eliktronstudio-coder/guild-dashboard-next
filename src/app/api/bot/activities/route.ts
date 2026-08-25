import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

const MAX_IMAGE_BYTES = 800_000;
const MAX_PARTICIPANTS = 60;

function isAuthorized(request: NextRequest) {
  const secret = process.env.BOT_API_SECRET;
  if (!secret) return false;
  const header = request.headers.get("authorization");
  return header === `Bearer ${secret}`;
}

function normalizeName(name: string) {
  return name.trim().toLowerCase();
}

// Ники в игровом интерфейсе иногда обрезаны многоточием ("Konigzav...") —
// ИИ добросовестно переписывает то, что видно на скрине. Для таких случаев
// пробуем найти игрока по началу ника, но только если подходит ровно один —
// при неоднозначности лучше оставить в гостях для ручной проверки.
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
// букв (не обрезка, а именно опечатка). Ищем игрока по близости ника —
// только если разница минимальна и подходит ровно один, иначе это слишком
// рискованно и лучше оставить в гостях.
function fuzzyThreshold(len: number) {
  if (len < 4) return 0;
  if (len <= 5) return 1;
  if (len <= 10) return 2;
  return 3;
}

const CATEGORIES = ["Мини-РБ", "Прайм"];

// Тестовая интеграция с Discord-ботом: бот присылает название активности и
// список ников, распознанных ИИ со скрина. Ники сверяются с игроками гильдии
// по имени (без учёта регистра) — совпавшие становятся участниками, остальные
// попадают в "гостей" как есть, чтобы админ мог разобрать их вручную.
export async function POST(request: NextRequest) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ error: "Нет доступа." }, { status: 403 });
  }

  const body = await request.json().catch(() => null);
  const name = typeof body?.name === "string" ? body.name.trim() : "";
  const category = typeof body?.category === "string" && CATEGORIES.includes(body.category) ? body.category : CATEGORIES[0];
  const screenshot = typeof body?.screenshot === "string" ? body.screenshot : "";
  const participantNames: string[] = Array.isArray(body?.participants)
    ? body.participants
        .filter((n: unknown): n is string => typeof n === "string")
        .map((n: string) => n.trim())
        .filter((n: string) => n.length > 0 && n.length <= 40)
    : [];

  if (!name || name.length > 60) {
    return NextResponse.json({ error: "Укажите название активности (до 60 символов)." }, { status: 400 });
  }
  if (participantNames.length > MAX_PARTICIPANTS) {
    return NextResponse.json({ error: `Слишком много участников (максимум ${MAX_PARTICIPANTS}).` }, { status: 400 });
  }
  if (screenshot && (!screenshot.startsWith("data:image/") || screenshot.length > MAX_IMAGE_BYTES)) {
    return NextResponse.json({ error: "Скрин слишком большой или неверного формата." }, { status: 400 });
  }

  const allPlayers = await prisma.player.findMany({ select: { id: true, name: true } });
  const byNormalizedName = new Map(allPlayers.map((p) => [normalizeName(p.name), p]));

  const matched: { input: string; playerId: string; playerName: string }[] = [];
  const unmatched: string[] = [];
  for (const raw of participantNames) {
    const player = byNormalizedName.get(normalizeName(raw));
    if (player) matched.push({ input: raw, playerId: player.id, playerName: player.name });
    else unmatched.push(raw);
  }

  const matchedPlayerIds = new Set(matched.map((m) => m.playerId));
  const stillUnmatched: string[] = [];
  for (const raw of unmatched) {
    const prefix = stripTruncationMark(raw);
    const normalizedPrefix = prefix ? normalizeName(prefix) : "";
    const candidates =
      prefix && normalizedPrefix.length >= 2
        ? allPlayers.filter((p) => !matchedPlayerIds.has(p.id) && normalizeName(p.name).startsWith(normalizedPrefix))
        : [];
    if (candidates.length === 1) {
      matched.push({ input: raw, playerId: candidates[0].id, playerName: candidates[0].name });
      matchedPlayerIds.add(candidates[0].id);
    } else {
      stillUnmatched.push(raw);
    }
  }

  const fuzzyUnmatched: string[] = [];
  for (const raw of stillUnmatched) {
    const normalized = normalizeName(raw);
    const threshold = fuzzyThreshold(normalized.length);
    let best: { player: (typeof allPlayers)[number]; distance: number } | null = null;
    let bestIsUnique = true;
    if (threshold > 0) {
      for (const player of allPlayers) {
        if (matchedPlayerIds.has(player.id)) continue;
        const distance = levenshtein(normalized, normalizeName(player.name));
        if (distance > threshold) continue;
        if (!best || distance < best.distance) {
          best = { player, distance };
          bestIsUnique = true;
        } else if (distance === best.distance) {
          bestIsUnique = false;
        }
      }
    }
    if (best && bestIsUnique) {
      matched.push({ input: raw, playerId: best.player.id, playerName: best.player.name });
      matchedPlayerIds.add(best.player.id);
    } else {
      fuzzyUnmatched.push(raw);
    }
  }

  const activity = await prisma.activity.create({
    data: {
      name,
      category,
      addedByUserId: null,
      participants: { create: matched.map((m) => ({ playerId: m.playerId })) },
      guests: { create: fuzzyUnmatched.map((n) => ({ name: n })) },
      screenshots: screenshot ? { create: [{ kind: "roster", imageUrl: screenshot }] } : undefined,
    },
  });

  return NextResponse.json(
    {
      activity: { id: activity.id, name: activity.name, category: activity.category },
      matched: matched.map((m) => ({ input: m.input, playerName: m.playerName })),
      unmatched: fuzzyUnmatched,
    },
    { status: 201 }
  );
}
