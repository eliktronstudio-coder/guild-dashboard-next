import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

const MAX_NAME = 40;

function isAuthorized(request: NextRequest) {
  const secret = process.env.BOT_API_SECRET;
  if (!secret) return false;
  return request.headers.get("authorization") === `Bearer ${secret}`;
}

function normalizeName(name: string) {
  return name.trim().toLowerCase();
}

/**
 * Rename a player, driven by the Discord rename channel.
 *
 * Matching is exact (case-insensitive) on purpose — unlike activity rosters,
 * where a fuzzy match only risks a wrong attendance tick, guessing here would
 * silently rename the wrong person's record.
 */
export async function POST(request: NextRequest) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ error: "Нет доступа." }, { status: 403 });
  }

  const body = await request.json().catch(() => null);
  const from = typeof body?.from === "string" ? body.from.trim() : "";
  const to = typeof body?.to === "string" ? body.to.trim() : "";

  if (!from || !to || from.length > MAX_NAME || to.length > MAX_NAME) {
    return NextResponse.json({ error: `Укажите оба ника (до ${MAX_NAME} символов).` }, { status: 400 });
  }
  if (normalizeName(from) === normalizeName(to)) {
    return NextResponse.json({ error: "Старый и новый ник совпадают." }, { status: 400 });
  }

  const players = await prisma.player.findMany({ select: { id: true, name: true } });
  const matches = players.filter((p) => normalizeName(p.name) === normalizeName(from));

  if (matches.length === 0) {
    return NextResponse.json({ error: `В составе нет игрока «${from}».` }, { status: 404 });
  }
  if (matches.length > 1) {
    return NextResponse.json({ error: `В составе несколько игроков «${from}» — переименуйте вручную.` }, { status: 409 });
  }

  const taken = players.find((p) => p.id !== matches[0].id && normalizeName(p.name) === normalizeName(to));
  if (taken) {
    return NextResponse.json({ error: `Ник «${taken.name}» уже занят другим игроком.` }, { status: 409 });
  }

  // Participants/payments/drops reference the player by id, so they follow the
  // rename on their own. Guest rows are the exception: they store the nickname
  // as text, for people the bot could not match to the roster.
  const guests = await prisma.activityGuest.findMany({ select: { id: true, name: true } });
  const staleGuestIds = guests.filter((g) => normalizeName(g.name) === normalizeName(from)).map((g) => g.id);

  const [updated] = await prisma.$transaction([
    prisma.player.update({ where: { id: matches[0].id }, data: { name: to } }),
    prisma.activityGuest.updateMany({ where: { id: { in: staleGuestIds } }, data: { name: to } }),
  ]);

  return NextResponse.json({
    player: { id: updated.id, from: matches[0].name, to: updated.name },
    renamedGuestEntries: staleGuestIds.length,
  });
}
