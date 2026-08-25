import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireActivitiesManager } from "@/lib/auth";

const STATUSES = ["К выплате", "Выплачено", "Отменено"];
const CATEGORIES = ["Мини-РБ", "Прайм"];
const MODES = ["PvE", "PvP"];
const DIFFICULTIES = ["Обычная", "Героическая"];

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const admin = await requireActivitiesManager();
  if (!admin) return NextResponse.json({ error: "Нет доступа." }, { status: 403 });

  const { id } = await params;
  const body = await request.json().catch(() => null);
  const data: Record<string, unknown> = {};

  if (body?.name !== undefined) {
    const name = typeof body.name === "string" ? body.name.trim() : "";
    if (!name || name.length > 60) {
      return NextResponse.json({ error: "Укажите название активности (до 60 символов)." }, { status: 400 });
    }
    data.name = name;
  }
  if (body?.date !== undefined) {
    const date = typeof body.date === "string" && body.date ? new Date(body.date) : null;
    if (!date || Number.isNaN(date.getTime())) {
      return NextResponse.json({ error: "Неверная дата." }, { status: 400 });
    }
    data.date = date;
  }
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

  const participantIds: string[] | null = Array.isArray(body?.participantIds)
    ? body.participantIds.filter((pid: unknown): pid is string => typeof pid === "string")
    : null;

  const activity = await prisma.$transaction(async (tx) => {
    if (participantIds !== null) {
      await tx.activityParticipant.deleteMany({ where: { activityId: id } });
      await tx.activityParticipant.createMany({
        data: participantIds.map((playerId: string) => ({ activityId: id, playerId })),
      });
    }
    return tx.activity.update({ where: { id }, data });
  });

  return NextResponse.json(activity);
}

export async function DELETE(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const admin = await requireActivitiesManager();
  if (!admin) return NextResponse.json({ error: "Нет доступа." }, { status: 403 });

  const { id } = await params;
  // DropItem.activity — onDelete: SetNull, поэтому дроп сам по себе не удалится
  // вместе с активностью и осядет в инвентаре без привязки. Удаляем явно.
  await prisma.$transaction([
    prisma.dropItem.deleteMany({ where: { activityId: id } }),
    prisma.activity.delete({ where: { id } }),
  ]);

  return NextResponse.json({ ok: true });
}
