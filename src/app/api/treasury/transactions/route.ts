import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/auth";

export async function POST(request: NextRequest) {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: "Нет доступа." }, { status: 403 });

  const body = await request.json().catch(() => null);
  const description = typeof body?.description === "string" ? body.description.trim() : "";
  const amount = Number(body?.amount);
  const dateStr = typeof body?.date === "string" ? body.date : "";

  if (!description || description.length > 100) {
    return NextResponse.json({ error: "Укажите описание операции (до 100 символов)." }, { status: 400 });
  }
  if (!Number.isFinite(amount) || amount === 0) {
    return NextResponse.json({ error: "Укажите сумму (положительную или отрицательную)." }, { status: 400 });
  }

  const date = dateStr ? new Date(dateStr) : new Date();
  if (Number.isNaN(date.getTime())) {
    return NextResponse.json({ error: "Неверная дата." }, { status: 400 });
  }

  const transaction = await prisma.treasuryTransaction.create({
    data: { description, amount, date },
  });

  return NextResponse.json(transaction, { status: 201 });
}
