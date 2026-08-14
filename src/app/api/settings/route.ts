import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/auth";

export async function PATCH(request: NextRequest) {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: "Нет доступа." }, { status: 403 });

  const body = await request.json().catch(() => null);
  const raidDropGoldEquivalent = Number(body?.raidDropGoldEquivalent);
  const nextPayoutDateStr = typeof body?.nextPayoutDate === "string" ? body.nextPayoutDate : "";

  if (!Number.isFinite(raidDropGoldEquivalent) || raidDropGoldEquivalent < 0) {
    return NextResponse.json({ error: "Неверное значение дропа с РБ." }, { status: 400 });
  }

  let nextPayoutDate: Date | null = null;
  if (nextPayoutDateStr) {
    nextPayoutDate = new Date(nextPayoutDateStr);
    if (Number.isNaN(nextPayoutDate.getTime())) {
      return NextResponse.json({ error: "Неверная дата выплаты." }, { status: 400 });
    }
  }

  const settings = await prisma.guildSettings.upsert({
    where: { id: 1 },
    update: { raidDropGoldEquivalent, nextPayoutDate },
    create: { id: 1, raidDropGoldEquivalent, nextPayoutDate },
  });

  return NextResponse.json(settings);
}
