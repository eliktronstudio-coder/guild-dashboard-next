import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin, getCurrentUser } from "@/lib/auth";
import { ROLES } from "@/lib/roles";
import { getPlayerById, getPlayerActivityHistory, getPlayerPayments, getPlayerAttendanceChartData } from "@/lib/queries";

export async function GET(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Нет доступа." }, { status: 403 });

  const { id } = await params;
  const [player, activities, payments, attendanceChart] = await Promise.all([
    getPlayerById(id),
    getPlayerActivityHistory(id),
    getPlayerPayments(id),
    getPlayerAttendanceChartData(id),
  ]);
  if (!player) return NextResponse.json({ error: "Игрок не найден." }, { status: 404 });

  return NextResponse.json({ player, activities, payments, attendanceChart });
}

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: "Нет доступа." }, { status: 403 });

  const { id } = await params;
  const body = await request.json().catch(() => null);
  const name = typeof body?.name === "string" ? body.name.trim() : "";
  const role = typeof body?.role === "string" ? body.role : "";
  const salaryCoefficient = body?.salaryCoefficient === undefined ? 1 : Number(body.salaryCoefficient);

  if (!name || name.length > 40) {
    return NextResponse.json({ error: "Укажите имя игрока (до 40 символов)." }, { status: 400 });
  }
  if (!ROLES.includes(role)) {
    return NextResponse.json({ error: "Неверная роль." }, { status: 400 });
  }
  if (!Number.isFinite(salaryCoefficient) || salaryCoefficient < 0 || salaryCoefficient > 1.25) {
    return NextResponse.json({ error: "Коэффициент должен быть от 0.0 до 1.25." }, { status: 400 });
  }

  const data: Record<string, unknown> = { name, role, salaryCoefficient };
  if (body?.level !== undefined) {
    const level = Number(body.level);
    if (!Number.isFinite(level) || level < 1 || level > 999) {
      return NextResponse.json({ error: "Неверный уровень." }, { status: 400 });
    }
    data.level = level;
  }
  if (body?.xp !== undefined) {
    const xp = Number(body.xp);
    if (!Number.isFinite(xp) || xp < 0) {
      return NextResponse.json({ error: "Неверный опыт." }, { status: 400 });
    }
    data.xp = xp;
  }

  const player = await prisma.player.update({
    where: { id },
    data,
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
