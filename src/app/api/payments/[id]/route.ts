import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/auth";

const STATUSES = ["Ожидает", "Подтверждено", "Выплачено"];

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: "Нет доступа." }, { status: 403 });

  const { id } = await params;
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
      return NextResponse.json({ error: "Укажите положительную сумму." }, { status: 400 });
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

export async function DELETE(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: "Нет доступа." }, { status: 403 });

  const { id } = await params;
  await prisma.payment.delete({ where: { id } });

  return NextResponse.json({ ok: true });
}
