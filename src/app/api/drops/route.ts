import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/auth";

export async function POST(request: NextRequest) {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: "Нет доступа." }, { status: 403 });

  const body = await request.json().catch(() => null);
  const item = typeof body?.item === "string" ? body.item.trim() : "";
  const value = Number(body?.value);
  const quantity = body?.quantity !== undefined ? Number(body.quantity) : 1;
  const dateStr = typeof body?.date === "string" ? body.date : "";
  const activityId = typeof body?.activityId === "string" && body.activityId ? body.activityId : null;
  const playerId = typeof body?.playerId === "string" && body.playerId ? body.playerId : null;
  const catalogItemId = typeof body?.catalogItemId === "string" && body.catalogItemId ? body.catalogItemId : null;

  if (!item || item.length > 60) {
    return NextResponse.json({ error: "Укажите название предмета (до 60 символов)." }, { status: 400 });
  }
  if (!Number.isFinite(value) || value < 0) {
    return NextResponse.json({ error: "Укажите стоимость в золоте (0 или больше)." }, { status: 400 });
  }
  if (!Number.isFinite(quantity) || quantity < 1) {
    return NextResponse.json({ error: "Количество должно быть не меньше 1." }, { status: 400 });
  }

  const date = dateStr ? new Date(dateStr) : new Date();
  if (Number.isNaN(date.getTime())) {
    return NextResponse.json({ error: "Неверная дата." }, { status: 400 });
  }

  if (activityId) {
    const activity = await prisma.activity.findUnique({ where: { id: activityId } });
    if (!activity) return NextResponse.json({ error: "Активность не найдена." }, { status: 404 });
  }
  if (playerId) {
    const player = await prisma.player.findUnique({ where: { id: playerId } });
    if (!player) return NextResponse.json({ error: "Игрок не найден." }, { status: 404 });
  }

  const drop = await prisma.dropItem.create({
    data: { item, value, quantity, date, activityId, playerId, catalogItemId },
    include: { activity: true, player: true },
  });

  return NextResponse.json(drop, { status: 201 });
}
