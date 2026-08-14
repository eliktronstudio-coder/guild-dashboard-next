import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/auth";

export async function POST(request: NextRequest) {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: "Нет доступа." }, { status: 403 });

  const body = await request.json().catch(() => null);
  const name = typeof body?.name === "string" ? body.name.trim() : "";
  const dateStr = typeof body?.date === "string" ? body.date : "";
  const participantIds = Array.isArray(body?.participantIds)
    ? body.participantIds.filter((id: unknown) => typeof id === "string")
    : [];

  if (!name || name.length > 60) {
    return NextResponse.json({ error: "Укажите название активности (до 60 символов)." }, { status: 400 });
  }

  const date = dateStr ? new Date(dateStr) : new Date();
  if (Number.isNaN(date.getTime())) {
    return NextResponse.json({ error: "Неверная дата." }, { status: 400 });
  }

  const activity = await prisma.activity.create({
    data: {
      name,
      date,
      participants: { create: participantIds.map((playerId: string) => ({ playerId })) },
    },
  });

  return NextResponse.json(activity, { status: 201 });
}
