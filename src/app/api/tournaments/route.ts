import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/auth";

const STATUSES = ["Регистрация", "Идёт", "Завершён"];

export async function POST(request: NextRequest) {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: "Нет доступа." }, { status: 403 });

  const body = await request.json().catch(() => null);
  const name = typeof body?.name === "string" ? body.name.trim() : "";
  const status = typeof body?.status === "string" ? body.status : "Регистрация";
  const teams = Number(body?.teams);
  const startDateStr = typeof body?.startDate === "string" ? body.startDate : "";
  const endDateStr = typeof body?.endDate === "string" ? body.endDate : "";

  if (!name || name.length > 60) {
    return NextResponse.json({ error: "Укажите название турнира (до 60 символов)." }, { status: 400 });
  }
  if (!STATUSES.includes(status)) {
    return NextResponse.json({ error: "Неверный статус." }, { status: 400 });
  }
  if (!Number.isFinite(teams) || teams < 0) {
    return NextResponse.json({ error: "Неверное количество команд." }, { status: 400 });
  }

  const startDate = startDateStr ? new Date(startDateStr) : new Date();
  if (Number.isNaN(startDate.getTime())) {
    return NextResponse.json({ error: "Неверная дата начала." }, { status: 400 });
  }
  const endDate = endDateStr ? new Date(endDateStr) : null;
  if (endDate && Number.isNaN(endDate.getTime())) {
    return NextResponse.json({ error: "Неверная дата окончания." }, { status: 400 });
  }

  const tournament = await prisma.tournament.create({
    data: { name, status, teams, startDate, endDate },
  });

  return NextResponse.json(tournament, { status: 201 });
}
