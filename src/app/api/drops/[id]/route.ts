import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/auth";

const DROP_STATUSES = ["Продано", "Не продано"];

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: "Нет доступа." }, { status: 403 });

  const { id } = await params;
  const body = await request.json().catch(() => null);
  const status = typeof body?.status === "string" ? body.status : "";

  if (!DROP_STATUSES.includes(status)) {
    return NextResponse.json({ error: "Неверный статус." }, { status: 400 });
  }

  const drop = await prisma.dropItem.findUnique({ where: { id } });
  if (!drop) return NextResponse.json({ error: "Запись не найдена." }, { status: 404 });

  if (status === drop.status) {
    return NextResponse.json(drop);
  }

  if (status === "Продано") {
    const updated = await prisma.$transaction(async (tx) => {
      const transaction = await tx.treasuryTransaction.create({
        data: { description: `Продажа дропа: ${drop.item}`, amount: drop.value * drop.quantity },
      });
      return tx.dropItem.update({
        where: { id },
        data: { status, treasuryTransactionId: transaction.id },
      });
    });
    return NextResponse.json(updated);
  }

  const reverted = await prisma.$transaction(async (tx) => {
    if (drop.treasuryTransactionId) {
      await tx.treasuryTransaction.delete({ where: { id: drop.treasuryTransactionId } }).catch(() => {});
    }
    return tx.dropItem.update({ where: { id }, data: { status, treasuryTransactionId: null } });
  });
  return NextResponse.json(reverted);
}

export async function DELETE(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: "Нет доступа." }, { status: 403 });

  const { id } = await params;
  const drop = await prisma.dropItem.findUnique({ where: { id } });
  if (drop?.treasuryTransactionId) {
    await prisma.treasuryTransaction.delete({ where: { id: drop.treasuryTransactionId } }).catch(() => {});
  }
  await prisma.dropItem.delete({ where: { id } });

  return NextResponse.json({ ok: true });
}
