import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/auth";
import { ROLES } from "@/lib/roles";

export async function POST(request: NextRequest) {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: "Нет доступа." }, { status: 403 });

  const body = await request.json().catch(() => null);
  const name = typeof body?.name === "string" ? body.name.trim() : "";
  const role = typeof body?.role === "string" ? body.role : "";
  const level = body?.level === undefined ? 1 : Number(body.level);
  const xp = body?.xp === undefined ? 0 : Number(body.xp);
  const salaryCoefficient = body?.salaryCoefficient === undefined ? 1 : Number(body.salaryCoefficient);
  const userId = typeof body?.userId === "string" ? body.userId : undefined;

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
  if (!Number.isFinite(salaryCoefficient) || salaryCoefficient < 0 || salaryCoefficient > 1.25) {
    return NextResponse.json({ error: "Коэффициент должен быть от 0.0 до 1.25." }, { status: 400 });
  }

  if (userId) {
    const unlinked = await prisma.player.findMany({ where: { userId: null } });
    const existing = unlinked.find((p) => p.name.toLowerCase() === name.toLowerCase());
    if (existing) {
      const linked = await prisma.player.update({
        where: { id: existing.id },
        data: { userId },
      });
      return NextResponse.json(linked, { status: 200 });
    }
  }

  const player = await prisma.player.create({
    data: { name, role, level, xp, salaryCoefficient, userId },
  });

  return NextResponse.json(player, { status: 201 });
}
