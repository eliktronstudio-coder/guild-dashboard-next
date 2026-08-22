import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/auth";
import { getAllPlayers } from "@/lib/queries";

function currentArchiveMonth() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
}

async function isAuthorized(request: NextRequest) {
  const secret = process.env.PAYOUT_ARCHIVE_SECRET;
  const header = request.headers.get("authorization");
  if (secret && header === `Bearer ${secret}`) return true;
  const admin = await requireAdmin();
  return admin !== null;
}

export async function POST(request: NextRequest) {
  if (!(await isAuthorized(request))) {
    return NextResponse.json({ error: "Нет доступа." }, { status: 403 });
  }

  const archiveMonth = currentArchiveMonth();

  const existing = await prisma.payment.findFirst({ where: { source: "archive", archiveMonth } });
  if (existing) {
    return NextResponse.json({ created: 0, archiveMonth, message: "Архив за этот месяц уже создан." });
  }

  const players = await getAllPlayers();
  const payable = players.filter((p) => p.salary > 0);

  if (payable.length === 0) {
    return NextResponse.json({ created: 0, archiveMonth, message: "Нет игроков с ненулевой зарплатой." });
  }

  const date = new Date();
  await prisma.payment.createMany({
    data: payable.map((p) => ({
      playerId: p.id,
      amount: p.salary,
      status: "Ожидает",
      date,
      source: "archive",
      archiveMonth,
    })),
  });

  return NextResponse.json({ created: payable.length, archiveMonth });
}
