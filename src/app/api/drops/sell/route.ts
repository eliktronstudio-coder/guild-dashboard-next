import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/auth";

// Продажа предмета из инвентаря — сразу всех непроданных записей с этим
// названием (несколько записей одного и того же предмета продаются одной
// операцией). Игроку из состава — сумма фиксирована (сумма value * quantity
// по всем записям). Аукциону — сумму вводит админ вручную.
export async function POST(request: NextRequest) {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: "Нет доступа." }, { status: 403 });

  const body = await request.json().catch(() => null);
  const entryIds = Array.isArray(body?.entryIds)
    ? body.entryIds.filter((id: unknown): id is string => typeof id === "string")
    : [];
  const playerId = typeof body?.playerId === "string" && body.playerId ? body.playerId : null;
  const manualAmount = body?.amount !== undefined ? Number(body.amount) : null;

  if (entryIds.length === 0) {
    return NextResponse.json({ error: "Не выбран предмет." }, { status: 400 });
  }

  const entries = await prisma.dropItem.findMany({ where: { id: { in: entryIds } } });
  if (entries.length !== entryIds.length || entries.some((e) => e.status === "Продано")) {
    return NextResponse.json({ error: "Часть предметов уже продана или не найдена." }, { status: 409 });
  }

  let buyerName: string | null = null;
  if (playerId) {
    const player = await prisma.player.findUnique({ where: { id: playerId } });
    if (!player) return NextResponse.json({ error: "Игрок не найден." }, { status: 404 });
    buyerName = player.name;
  } else if (!Number.isFinite(manualAmount) || (manualAmount as number) < 0) {
    return NextResponse.json({ error: "Укажите сумму продажи (0 или больше)." }, { status: 400 });
  }

  const fixedTotal = entries.reduce((sum, e) => sum + e.value * e.quantity, 0);
  const totalAmount = playerId ? fixedTotal : Math.round(manualAmount as number);
  const description = `Продажа дропа: ${entries[0].item} — ${buyerName ?? "аукцион"}`;

  await prisma.$transaction(async (tx) => {
    const transaction = await tx.treasuryTransaction.create({
      data: { description, amount: totalAmount },
    });
    await tx.dropItem.updateMany({
      where: { id: { in: entryIds } },
      data: { status: "Продано", playerId, treasuryTransactionId: transaction.id },
    });
  });

  return NextResponse.json({ ok: true });
}
