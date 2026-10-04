import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";

const ALLOWED_HOST = "aje-calc.h1n.ru";
const MAX_LABEL = 40;

function isAllowedBuildUrl(value: string): boolean {
  try {
    const url = new URL(value);
    return url.hostname === ALLOWED_HOST && (url.protocol === "https:" || url.protocol === "http:");
  } catch {
    return false;
  }
}

/** Сохранять сборки может только сам игрок — не ГМ за него. */
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Нужно войти." }, { status: 401 });

  const { id } = await params;
  const player = await prisma.player.findUnique({ where: { id }, select: { userId: true } });
  if (!player) return NextResponse.json({ error: "Игрок не найден." }, { status: 404 });
  if (player.userId !== user.sub) {
    return NextResponse.json({ error: "Сохранять сборки можно только себе." }, { status: 403 });
  }

  const body = await request.json().catch(() => null);
  const url = typeof body?.url === "string" ? body.url.trim() : "";
  const label = typeof body?.label === "string" ? body.label.trim() : "";

  if (!url || !isAllowedBuildUrl(url)) {
    return NextResponse.json({ error: `Ссылка должна вести на ${ALLOWED_HOST}.` }, { status: 400 });
  }
  if (!label || label.length > MAX_LABEL) {
    return NextResponse.json({ error: `Укажите подпись (до ${MAX_LABEL} символов).` }, { status: 400 });
  }

  const build = await prisma.savedBuild.create({
    data: { playerId: id, url, label },
    select: { id: true, label: true, url: true, createdAt: true },
  });
  return NextResponse.json({ build });
}
