import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import { ACHIEVEMENTS } from "@/lib/achievements/catalog";

const VALID_KEYS = new Set(ACHIEVEMENTS.map((a) => a.key));

/** Закрепить свои достижения может только сам игрок — не ГМ за него. */
export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Нужно войти." }, { status: 401 });

  const { id } = await params;
  const player = await prisma.player.findUnique({ where: { id }, select: { userId: true } });
  if (!player) return NextResponse.json({ error: "Игрок не найден." }, { status: 404 });
  if (player.userId !== user.sub) {
    return NextResponse.json({ error: "Закреплять можно только свои достижения." }, { status: 403 });
  }

  const body = await request.json().catch(() => null);
  const keys = Array.isArray(body?.keys) ? body.keys : null;
  if (!keys || keys.length > 3 || !keys.every((k: unknown) => typeof k === "string" && VALID_KEYS.has(k))) {
    return NextResponse.json({ error: "Нужно от 0 до 3 существующих ключей достижений." }, { status: 400 });
  }
  if (new Set(keys).size !== keys.length) {
    return NextResponse.json({ error: "Ключи повторяются." }, { status: 400 });
  }

  await prisma.player.update({ where: { id }, data: { pinnedAchievements: JSON.stringify(keys) } });
  return NextResponse.json({ ok: true });
}
