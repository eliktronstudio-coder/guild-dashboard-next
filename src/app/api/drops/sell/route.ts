import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/auth";

// Продажа предмета из инвентаря — можно продать не весь остаток, а
// только часть (любое количество от 1 до суммарного остатка). Единицы
// "снимаются" по очереди с записей дропа (от новых к старым, как их
// отдаёт getInventory()); если запись раскладывается не целиком —
// делим её: одна часть остаётся в инвентаре, другая уходит в продажу
// отдельной новой записью. Игроку из состава — сумма фиксирована
// (сумма value по проданным единицам). Аукциону — сумму вводит админ.
export async function POST(request: NextRequest) {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: "Нет доступа." }, { status: 403 });

  const body = await request.json().catch(() => null);
  const entryIds = Array.isArray(body?.entryIds)
    ? body.entryIds.filter((id: unknown): id is string => typeof id === "string")
    : [];
  const quantity = Math.round(Number(body?.quantity));
  const playerId = typeof body?.playerId === "string" && body.playerId ? body.playerId : null;
  const manualAmount = body?.amount !== undefined ? Number(body.amount) : null;

  if (entryIds.length === 0) {
    return NextResponse.json({ error: "Не выбран предмет." }, { status: 400 });
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

  let buyerName: string | null = null;
  if (playerId) {
    const player = await prisma.player.findUnique({ where: { id: playerId } });
    if (!player) return NextResponse.json({ error: "Игрок не найден." }, { status: 404 });
    buyerName = player.name;
  } else if (!Number.isFinite(manualAmount) || (manualAmount as number) < 0) {
    return NextResponse.json({ error: "Укажите сумму продажи (0 или больше)." }, { status: 400 });
  }

  let remaining = quantity;
  let fixedTotal = 0;
  const fullySoldIds: string[] = [];
  let partial: { id: string; take: number; leftover: number } | null = null;

  for (const e of entries) {
    if (remaining <= 0) break;
    const take = Math.min(remaining, e.quantity);
    fixedTotal += take * e.value;
    if (take === e.quantity) {
      fullySoldIds.push(e.id);
    } else {
      partial = { id: e.id, take, leftover: e.quantity - take };
    }
    remaining -= take;
  }

  const totalAmount = playerId ? fixedTotal : Math.round(manualAmount as number);
  const description = `Продажа дропа: ${entries[0].item} — ${buyerName ?? "аукцион"}`;

  await prisma.$transaction(async (tx) => {
    const transaction = await tx.treasuryTransaction.create({
      data: { description, amount: totalAmount },
    });

    if (fullySoldIds.length > 0) {
      await tx.dropItem.updateMany({
        where: { id: { in: fullySoldIds } },
        data: { status: "Продано", playerId, treasuryTransactionId: transaction.id },
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
          status: "Продано",
          date: original.date,
          activityId: original.activityId,
          catalogItemId: original.catalogItemId,
          playerId,
          treasuryTransactionId: transaction.id,
        },
      });
    }
  });

  return NextResponse.json({ ok: true });
}
