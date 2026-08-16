import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/auth";

// Продажа предмета из инвентаря. Игроку из состава — сумма фиксирована
// (value * quantity, как записано в журнале/реестре дропа). Аукциону —
// сумму вводит админ вручную, и она становится новой ценой записи.
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: "Нет доступа." }, { status: 403 });

  const { id } = await params;
  const body = await request.json().catch(() => null);
  const playerId = typeof body?.playerId === "string" && body.playerId ? body.playerId : null;
  const manualAmount = body?.amount !== undefined ? Number(body.amount) : null;

  const drop = await prisma.dropItem.findUnique({ where: { id } });
  if (!drop) return NextResponse.json({ error: "Запись не найдена." }, { status: 404 });
  if (drop.status === "Продано") {
    return NextResponse.json({ error: "Этот предмет уже продан." }, { status: 409 });
  }

  let buyerName: string | null = null;
  if (playerId) {
    const player = await prisma.player.findUnique({ where: { id: playerId } });
    if (!player) return NextResponse.json({ error: "Игрок не найден." }, { status: 404 });
    buyerName = player.name;
  } else if (!Number.isFinite(manualAmount) || (manualAmount as number) < 0) {
    return NextResponse.json({ error: "Укажите сумму продажи (0 или больше)." }, { status: 400 });
  }

  const totalAmount = playerId ? drop.value * drop.quantity : Math.round(manualAmount as number);
  const perUnitValue = playerId ? drop.value : Math.round(totalAmount / drop.quantity);
  const description = `Продажа дропа: ${drop.item} — ${buyerName ?? "аукцион"}`;

  const updated = await prisma.$transaction(async (tx) => {
    const transaction = await tx.treasuryTransaction.create({
      data: { description, amount: totalAmount },
    });
    return tx.dropItem.update({
      where: { id },
      data: { status: "Продано", playerId, value: perUnitValue, treasuryTransactionId: transaction.id },
    });
  });

  return NextResponse.json(updated);
}
