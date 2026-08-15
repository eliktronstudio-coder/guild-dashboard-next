import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/auth";

const STATUSES = ["К выплате", "Выплачено", "Отменено"];
const CATEGORIES = ["Мини-РБ", "Прайм"];
const MODES = ["PvE", "PvP"];
const DIFFICULTIES = ["Обычная", "Героическая"];

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: "Нет доступа." }, { status: 403 });

  const { id } = await params;
  const body = await request.json().catch(() => null);
  const data: Record<string, unknown> = {};

  if (body?.status !== undefined) {
    if (!STATUSES.includes(body.status)) return NextResponse.json({ error: "Неверный статус." }, { status: 400 });
    data.status = body.status;
  }
  if (body?.category !== undefined) {
    if (!CATEGORIES.includes(body.category)) return NextResponse.json({ error: "Неверный вид." }, { status: 400 });
    data.category = body.category;
  }
  if (body?.mode !== undefined) {
    if (!MODES.includes(body.mode)) return NextResponse.json({ error: "Неверный режим." }, { status: 400 });
    data.mode = body.mode;
  }
  if (body?.difficulty !== undefined) {
    if (!DIFFICULTIES.includes(body.difficulty))
      return NextResponse.json({ error: "Неверная сложность." }, { status: 400 });
    data.difficulty = body.difficulty;
  }
  if (body?.isNight !== undefined) {
    data.isNight = Boolean(body.isNight);
  }
  if (body?.perAttendanceValue !== undefined) {
    const value = Number(body.perAttendanceValue);
    if (!Number.isFinite(value) || value < 0) {
      return NextResponse.json({ error: "Неверная сумма за посещение." }, { status: 400 });
    }
    data.perAttendanceValue = value;
  }

  const activity = await prisma.activity.update({ where: { id }, data });

  return NextResponse.json(activity);
}

export async function DELETE(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: "Нет доступа." }, { status: 403 });

  const { id } = await params;
  await prisma.activity.delete({ where: { id } });

  return NextResponse.json({ ok: true });
}
