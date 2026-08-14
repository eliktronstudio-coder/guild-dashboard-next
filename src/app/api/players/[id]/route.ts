import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/auth";
import { ROLES } from "@/lib/roles";

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: "Нет доступа." }, { status: 403 });

  const { id } = await params;
  const body = await request.json().catch(() => null);
  const name = typeof body?.name === "string" ? body.name.trim() : "";
  const role = typeof body?.role === "string" ? body.role : "";
  const level = Number(body?.level);
  const xp = Number(body?.xp);
  const attendancePct = Number(body?.attendancePct);

  if (!name || name.length > 40) {
    return NextResponse.json({ error: "Укажите имя игрока (до 40 символов)." }, { status: 400 });
  }
  if (!ROLES.includes(role)) {
    return NextResponse.json({ error: "Неверная роль." }, { status: 400 });
  }
  if (!Number.isFinite(level) || level < 1 || level > 999) {
    return NextResponse.json({ error: "Неверный уровень." }, { status: 400 });
  }
  if (!Number.isFinite(xp) || xp < 0) {
    return NextResponse.json({ error: "Неверный опыт." }, { status: 400 });
  }
  if (!Number.isFinite(attendancePct) || attendancePct < 0 || attendancePct > 100) {
    return NextResponse.json({ error: "Посещаемость должна быть от 0 до 100." }, { status: 400 });
  }

  const player = await prisma.player.update({
    where: { id },
    data: { name, role, level, xp, attendancePct },
  });

  return NextResponse.json(player);
}

export async function DELETE(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: "Нет доступа." }, { status: 403 });

  const { id } = await params;
  await prisma.player.delete({ where: { id } });

  return NextResponse.json({ ok: true });
}
