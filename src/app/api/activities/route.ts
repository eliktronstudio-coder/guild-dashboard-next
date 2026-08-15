import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/auth";

const CATEGORIES = ["Мини-РБ", "Прайм"];
const MODES = ["PvE", "PvP"];
const DIFFICULTIES = ["Обычная", "Героическая"];

export async function POST(request: NextRequest) {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: "Нет доступа." }, { status: 403 });

  const body = await request.json().catch(() => null);
  const name = typeof body?.name === "string" ? body.name.trim() : "";
  const dateStr = typeof body?.date === "string" ? body.date : "";
  const category = typeof body?.category === "string" && CATEGORIES.includes(body.category) ? body.category : CATEGORIES[0];
  const mode = typeof body?.mode === "string" && MODES.includes(body.mode) ? body.mode : MODES[0];
  const difficulty =
    typeof body?.difficulty === "string" && DIFFICULTIES.includes(body.difficulty) ? body.difficulty : DIFFICULTIES[0];
  const isNight = Boolean(body?.isNight);
  const perAttendanceValue = Number.isFinite(Number(body?.perAttendanceValue)) ? Number(body.perAttendanceValue) : 0;
  const participantIds = Array.isArray(body?.participantIds)
    ? body.participantIds.filter((id: unknown) => typeof id === "string")
    : [];

  if (!name || name.length > 60) {
    return NextResponse.json({ error: "Укажите название активности (до 60 символов)." }, { status: 400 });
  }

  const date = dateStr ? new Date(dateStr) : new Date();
  if (Number.isNaN(date.getTime())) {
    return NextResponse.json({ error: "Неверная дата." }, { status: 400 });
  }
  if (perAttendanceValue < 0) {
    return NextResponse.json({ error: "Сумма за посещение не может быть отрицательной." }, { status: 400 });
  }

  const activity = await prisma.activity.create({
    data: {
      name,
      date,
      category,
      mode,
      difficulty,
      isNight,
      perAttendanceValue,
      addedByUserId: admin.sub,
      participants: { create: participantIds.map((playerId: string) => ({ playerId })) },
    },
  });

  return NextResponse.json(activity, { status: 201 });
}
