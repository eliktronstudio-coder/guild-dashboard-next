import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/auth";

const STATUSES = ["Ожидает", "Подтверждено", "Выплачено"];

export async function POST(request: NextRequest) {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: "Нет доступа." }, { status: 403 });

  const body = await request.json().catch(() => null);
  const playerId = typeof body?.playerId === "string" ? body.playerId : "";
  const amount = Number(body?.amount);
  const status = typeof body?.status === "string" ? body.status : "Ожидает";
  const dateStr = typeof body?.date === "string" ? body.date : "";

  if (!playerId) {
    return NextResponse.json({ error: "Выберите игрока." }, { status: 400 });
  }
  if (!Number.isFinite(amount) || amount <= 0) {
    return NextResponse.json({ error: "Укажите положительную сумму." }, { status: 400 });
  }
  if (!STATUSES.includes(status)) {
    return NextResponse.json({ error: "Неверный статус." }, { status: 400 });
  }

  const date = dateStr ? new Date(dateStr) : new Date();
  if (Number.isNaN(date.getTime())) {
    return NextResponse.json({ error: "Неверная дата." }, { status: 400 });
  }

  const player = await prisma.player.findUnique({ where: { id: playerId } });
  if (!player) {
    return NextResponse.json({ error: "Игрок не найден." }, { status: 404 });
  }

  const payment = await prisma.payment.create({
    data: { playerId, amount, status, date },
    include: { player: true },
  });

  return NextResponse.json(payment, { status: 201 });
}
