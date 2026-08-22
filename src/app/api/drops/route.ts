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
  // Ручной выбор склада/категории (форма "Добавить дроп" на складе ХД) —
  // переопределяет авто-маршрут по активности, если задан явно.
  const forcedWarehouse = ["ХД", "НТ", "Общий"].includes(body?.warehouse) ? (body.warehouse as string) : null;
  const forcedCategory = ["Прайм", "Мини-РБ"].includes(body?.category) ? (body.category as string) : null;

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

  // Куда падает дроп: с Мини-РБ активности — сразу на склад ХД, со всего
  // остального (Прайм или без активности) — в Общий инвентарь, откуда
  // админ вручную распределяет его по ХД/НТ (см. /api/drops/transfer).
  // Категория запоминается отдельно от склада — нужна, чтобы разделять
  // "Дроп с Мини-РБ / Дроп с Прайм", когда предмет добавлен вручную
  // (без активности) или сразу на конкретный склад с явным выбором.
  let warehouse = forcedWarehouse ?? "Общий";
  let category = forcedCategory;
  if (activityId) {
    const activity = await prisma.activity.findUnique({ where: { id: activityId } });
    if (!activity) return NextResponse.json({ error: "Активность не найдена." }, { status: 404 });
    if (!forcedWarehouse && activity.category === "Мини-РБ") warehouse = "ХД";
    if (!category) category = activity.category;
  }
  if (playerId) {
    const player = await prisma.player.findUnique({ where: { id: playerId } });
    if (!player) return NextResponse.json({ error: "Игрок не найден." }, { status: 404 });
  }

  const drop = await prisma.dropItem.create({
    data: { item, value, quantity, date, activityId, playerId, catalogItemId, warehouse, category },
    include: { activity: true, player: true },
  });

  return NextResponse.json(drop, { status: 201 });
}
