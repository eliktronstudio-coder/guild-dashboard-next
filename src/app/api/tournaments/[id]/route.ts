import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/auth";

const STATUSES = ["Регистрация", "Идёт", "Завершён"];

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: "Нет доступа." }, { status: 403 });

  const { id } = await params;
  const body = await request.json().catch(() => null);
  const status = typeof body?.status === "string" ? body.status : "";

  if (!STATUSES.includes(status)) {
    return NextResponse.json({ error: "Неверный статус." }, { status: 400 });
  }

  const tournament = await prisma.tournament.update({ where: { id }, data: { status } });

  return NextResponse.json(tournament);
}

export async function DELETE(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: "Нет доступа." }, { status: 403 });

  const { id } = await params;
  await prisma.tournament.delete({ where: { id } });

  return NextResponse.json({ ok: true });
}
