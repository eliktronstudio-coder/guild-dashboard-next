import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/auth";

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: "Нет доступа." }, { status: 403 });

  const { id } = await params;
  const body = await request.json().catch(() => null);

  const drop = await prisma.dropItem.findUnique({ where: { id } });
  if (!drop) return NextResponse.json({ error: "Запись не найдена." }, { status: 404 });

  const data: Record<string, unknown> = {};
  if (body?.item !== undefined) {
    const item = typeof body.item === "string" ? body.item.trim() : "";
    if (!item || item.length > 60) {
      return NextResponse.json({ error: "Укажите название предмета (до 60 символов)." }, { status: 400 });
    }
    data.item = item;
  }
  if (body?.value !== undefined) {
    const value = Number(body.value);
    if (!Number.isFinite(value) || value < 0) {
      return NextResponse.json({ error: "Укажите стоимость в золоте (0 или больше)." }, { status: 400 });
    }
    data.value = value;
  }
  if (body?.quantity !== undefined) {
    const quantity = Number(body.quantity);
    if (!Number.isFinite(quantity) || quantity < 1) {
      return NextResponse.json({ error: "Количество должно быть не меньше 1." }, { status: 400 });
    }
    data.quantity = quantity;
  }

  if (Object.keys(data).length === 0) {
    return NextResponse.json({ error: "Нечего сохранять." }, { status: 400 });
  }

  const updated = await prisma.dropItem.update({ where: { id }, data });
  return NextResponse.json(updated);
}

// Удаление предмета из инвентаря: если он лежит на ХД или НТ, значит
// когда-то попал туда из Общего инвентаря (переносом или авто-маршрутом
// с Мини-РБ активности) — "удаление" тут просто возвращает его в Общий,
// а не стирает. Окончательно предмет удаляется, только если он уже и так
// лежит в Общем инвентаре.
export async function DELETE(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: "Нет доступа." }, { status: 403 });

  const { id } = await params;
  const drop = await prisma.dropItem.findUnique({ where: { id } });
  if (!drop) return NextResponse.json({ error: "Запись не найдена." }, { status: 404 });

  if (drop.warehouse !== "Общий") {
    const returned = await prisma.dropItem.update({ where: { id }, data: { warehouse: "Общий" } });
    return NextResponse.json(returned);
  }

  if (drop.treasuryTransactionId) {
    await prisma.treasuryTransaction.delete({ where: { id: drop.treasuryTransactionId } }).catch(() => {});
  }
  await prisma.dropItem.delete({ where: { id } });

  return NextResponse.json({ ok: true });
}
