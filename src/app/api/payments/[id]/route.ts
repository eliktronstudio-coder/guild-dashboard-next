import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/auth";

const STATUSES = ["Ожидает", "Подтверждено", "Выплачено"];

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const admin = await requireAdmin();
  if (!admin)
    return NextResponse.json({ error: "Нет доступа." }, { status: 403 });

  const { id } = await params;
  const existing = await prisma.payment.findUnique({ where: { id } });
  if (!existing)
    return NextResponse.json({ error: "Выплата не найдена." }, { status: 404 });
  if (existing.source === "payout")
    return NextResponse.json(
      {
        error:
          "Начисление связано с казной. Используйте действие отмены выплаты в расчёте периода.",
      },
      { status: 409 },
    );
  const body = await request.json().catch(() => null);

  const data: { status?: string; amount?: number; date?: Date } = {};

  if (body?.status !== undefined) {
    if (!STATUSES.includes(body.status)) {
      return NextResponse.json({ error: "Неверный статус." }, { status: 400 });
    }
    data.status = body.status;
  }

  if (body?.amount !== undefined) {
    const amount = Number(body.amount);
    if (!Number.isFinite(amount) || amount <= 0) {
      return NextResponse.json(
        { error: "Укажите положительную сумму." },
        { status: 400 },
      );
    }
    data.amount = amount;
  }

  if (body?.date !== undefined) {
    const date = new Date(body.date);
    if (Number.isNaN(date.getTime())) {
      return NextResponse.json({ error: "Неверная дата." }, { status: 400 });
    }
    data.date = date;
  }

  if (Object.keys(data).length === 0) {
    return NextResponse.json({ error: "Нечего обновлять." }, { status: 400 });
  }

  const payment = await prisma.payment.update({
    where: { id },
    data,
    include: { player: true },
  });

  return NextResponse.json(payment);
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const admin = await requireAdmin();
  if (!admin)
    return NextResponse.json({ error: "Нет доступа." }, { status: 403 });

  const { id } = await params;
  const existing = await prisma.payment.findUnique({ where: { id } });
  if (!existing)
    return NextResponse.json({ error: "Выплата не найдена." }, { status: 404 });
  if (existing.source === "payout" || existing.status === "Выплачено")
    return NextResponse.json(
      {
        error: "Финансовую историю нельзя удалить. Используйте отмену выплаты.",
      },
      { status: 409 },
    );
  await prisma.payment.delete({ where: { id } });

  return NextResponse.json({ ok: true });
}
