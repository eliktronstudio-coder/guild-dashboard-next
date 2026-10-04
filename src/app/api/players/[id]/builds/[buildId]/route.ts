import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";

export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string; buildId: string }> }) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Нужно войти." }, { status: 401 });

  const { id, buildId } = await params;
  const player = await prisma.player.findUnique({ where: { id }, select: { userId: true } });
  if (!player) return NextResponse.json({ error: "Игрок не найден." }, { status: 404 });
  if (player.userId !== user.sub) {
    return NextResponse.json({ error: "Удалять можно только свои сборки." }, { status: 403 });
  }

  const build = await prisma.savedBuild.findUnique({ where: { id: buildId } });
  if (!build || build.playerId !== id) {
    return NextResponse.json({ error: "Сборка не найдена." }, { status: 404 });
  }

  await prisma.savedBuild.delete({ where: { id: buildId } });
  return NextResponse.json({ ok: true });
}
