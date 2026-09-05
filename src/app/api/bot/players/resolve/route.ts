import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { findBestMatch, findCandidates } from "@/lib/nameMatch";

/** Discord показывает не больше 25 вариантов в одном списке. */
const MAX_CANDIDATES = 5;

function isAuthorized(request: NextRequest) {
  const secret = process.env.BOT_API_SECRET;
  if (!secret) return false;
  return request.headers.get("authorization") === `Bearer ${secret}`;
}

/**
 * Разбирает ники с ростер-скрина по составу гильдии. Если ник читается
 * нечётко (опечатка больше обычного порога, шрифт мелкий/стилизованный) и
 * findBestMatch не смог однозначно его определить — возвращает похожих
 * игроков списком, чтобы человек выбрал нужного в Discord, а не полагаться
 * на угадывание. Если похожих вообще нет — это, скорее всего, реальный
 * гость, а не плохое распознавание, и такие имена не переспрашиваются.
 */
export async function POST(request: NextRequest) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ error: "Нет доступа." }, { status: 403 });
  }

  const body = await request.json().catch(() => null);
  const names: string[] = Array.isArray(body?.names)
    ? body.names
        .filter((n: unknown): n is string => typeof n === "string")
        .map((n: string) => n.trim())
        .filter((n: string) => n.length > 0 && n.length <= 40)
    : [];

  const players = await prisma.player.findMany({ select: { id: true, name: true } });

  const results = names.map((input) => {
    const matched = findBestMatch(input, players);
    if (matched) {
      return { input, matched: { id: matched.id, name: matched.name }, candidates: [] };
    }
    const candidates = findCandidates(input, players, MAX_CANDIDATES);
    return {
      input,
      matched: null,
      candidates: candidates.map((c) => ({ id: c.id, name: c.name })),
    };
  });

  return NextResponse.json({ results });
}
