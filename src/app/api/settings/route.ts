import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/auth";

export async function PATCH(request: NextRequest) {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: "Нет доступа." }, { status: 403 });

  const body = await request.json().catch(() => null);
  const hasPayoutDate = body?.nextPayoutDate !== undefined;
  const nextPayoutDateStr = typeof body?.nextPayoutDate === "string" ? body.nextPayoutDate : "";

  let nextPayoutDate: Date | null = null;
  if (nextPayoutDateStr) {
    nextPayoutDate = new Date(nextPayoutDateStr);
    if (Number.isNaN(nextPayoutDate.getTime())) {
      return NextResponse.json({ error: "Неверная дата выплаты." }, { status: 400 });
    }
  }

  const hasGsTiers = body?.salaryGsTier1 !== undefined || body?.salaryGsTier2 !== undefined;
  const salaryGsTier1 = Number(body?.salaryGsTier1);
  const salaryGsTier2 = Number(body?.salaryGsTier2);
  if (hasGsTiers) {
    if (!Number.isFinite(salaryGsTier1) || salaryGsTier1 < 0) {
      return NextResponse.json({ error: "Неверный порог ГС (50%)." }, { status: 400 });
    }
    if (!Number.isFinite(salaryGsTier2) || salaryGsTier2 < salaryGsTier1) {
      return NextResponse.json(
        { error: "Порог ГС (100%) должен быть не меньше порога ГС (50%)." },
        { status: 400 }
      );
    }
  }

  const settings = await prisma.guildSettings.upsert({
    where: { id: 1 },
    update: {
      ...(hasPayoutDate ? { nextPayoutDate } : {}),
      ...(hasGsTiers ? { salaryGsTier1, salaryGsTier2 } : {}),
    },
    create: {
      id: 1,
      nextPayoutDate,
      salaryGsTier1: hasGsTiers ? salaryGsTier1 : 10000,
      salaryGsTier2: hasGsTiers ? salaryGsTier2 : 20000,
    },
  });

  return NextResponse.json(settings);
}
