import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/auth";

const DROP_STATUSES = ["Продано", "Не продано"];

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: "Нет доступа." }, { status: 403 });

  const { id } = await params;
  const body = await request.json().catch(() => null);

  const drop = await prisma.dropItem.findUnique({ where: { id } });
  if (!drop) return NextResponse.json({ error: "Запись не найдена." }, { status: 404 });

  // Редактирование названия/количества/цены — отдельная ветка от смены статуса,
  // не трогает казну (это делает только переключение "Продано").
  if (body?.item !== undefined || body?.value !== undefined || body?.quantity !== undefined) {
    const data: Record<string, unknown> = {};
    if (body.item !== undefined) {
      const item = typeof body.item === "string" ? body.item.trim() : "";
      if (!item || item.length > 60) {
        return NextResponse.json({ error: "Укажите название предмета (до 60 символов)." }, { status: 400 });
      }
      data.item = item;
    }
    if (body.value !== undefined) {
      const value = Number(body.value);
      if (!Number.isFinite(value) || value < 0) {
        return NextResponse.json({ error: "Укажите стоимость в золоте (0 или больше)." }, { status: 400 });
      }
      data.value = value;
    }
    if (body.quantity !== undefined) {
      const quantity = Number(body.quantity);
      if (!Number.isFinite(quantity) || quantity < 1) {
        return NextResponse.json({ error: "Количество должно быть не меньше 1." }, { status: 400 });
      }
      data.quantity = quantity;
    }
    const updated = await prisma.dropItem.update({ where: { id }, data });
    return NextResponse.json(updated);
  }

  const status = typeof body?.status === "string" ? body.status : "";

  if (!DROP_STATUSES.includes(status)) {
    return NextResponse.json({ error: "Неверный статус." }, { status: 400 });
  }

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
