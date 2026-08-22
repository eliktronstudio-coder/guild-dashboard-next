import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/auth";

const TARGETS = ["ХД", "НТ"];

// Перенос предмета из Общего инвентаря на склад ХД или НТ — можно
// перенести не весь остаток, а часть (как при продаже). Единицы
// "снимаются" по очереди с записей дропа (от новых к старым); если
// запись раскладывается не целиком — делим её: часть уходит на новый
// склад отдельной новой записью, остаток остаётся на месте.
export async function POST(request: NextRequest) {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: "Нет доступа." }, { status: 403 });

  const body = await request.json().catch(() => null);
  const entryIds = Array.isArray(body?.entryIds)
    ? body.entryIds.filter((id: unknown): id is string => typeof id === "string")
    : [];
  const warehouse = typeof body?.warehouse === "string" ? body.warehouse : "";
  const quantity = Math.round(Number(body?.quantity));

  if (entryIds.length === 0) {
    return NextResponse.json({ error: "Не выбран предмет." }, { status: 400 });
  }
  if (!TARGETS.includes(warehouse)) {
    return NextResponse.json({ error: "Неверный склад назначения." }, { status: 400 });
  }
  if (!Number.isFinite(quantity) || quantity < 1) {
    return NextResponse.json({ error: "Некорректное количество." }, { status: 400 });
  }

  const entries = await prisma.dropItem.findMany({
    where: { id: { in: entryIds } },
    orderBy: { date: "desc" },
  });
  const availableQty = entries.reduce((sum, e) => sum + e.quantity, 0);
  if (entries.length !== entryIds.length || entries.some((e) => e.status === "Продано")) {
    return NextResponse.json({ error: "Часть предметов уже продана или не найдена." }, { status: 409 });
  }
  if (quantity > availableQty) {
    return NextResponse.json({ error: "В инвентаре нет столько единиц." }, { status: 400 });
  }

  let remaining = quantity;
  const fullyMovedIds: string[] = [];
  let partial: { id: string; take: number; leftover: number } | null = null;

  for (const e of entries) {
    if (remaining <= 0) break;
    const take = Math.min(remaining, e.quantity);
    if (take === e.quantity) {
      fullyMovedIds.push(e.id);
    } else {
      partial = { id: e.id, take, leftover: e.quantity - take };
    }
    remaining -= take;
  }

  await prisma.$transaction(async (tx) => {
    if (fullyMovedIds.length > 0) {
      await tx.dropItem.updateMany({
        where: { id: { in: fullyMovedIds } },
        data: { warehouse },
      });
    }

    if (partial) {
      const original = entries.find((e) => e.id === partial!.id)!;
      await tx.dropItem.update({
        where: { id: original.id },
        data: { quantity: partial.leftover },
      });
      await tx.dropItem.create({
        data: {
          item: original.item,
          value: original.value,
          quantity: partial.take,
          status: "Не продано",
          warehouse,
          date: original.date,
          activityId: original.activityId,
          catalogItemId: original.catalogItemId,
          playerId: original.playerId,
        },
      });
    }
  });

  return NextResponse.json({ ok: true });
}
