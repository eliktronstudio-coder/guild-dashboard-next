import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/auth";

const TARGETS = ["ХД", "НТ"];

// Перенос предмета из Общего инвентаря на склад ХД или НТ. Переносится
// весь остаток выбранного предмета (все записи разом), не проданный.
export async function POST(request: NextRequest) {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: "Нет доступа." }, { status: 403 });

  const body = await request.json().catch(() => null);
  const entryIds = Array.isArray(body?.entryIds)
    ? body.entryIds.filter((id: unknown): id is string => typeof id === "string")
    : [];
  const warehouse = typeof body?.warehouse === "string" ? body.warehouse : "";

  if (entryIds.length === 0) {
    return NextResponse.json({ error: "Не выбран предмет." }, { status: 400 });
  }
  if (!TARGETS.includes(warehouse)) {
    return NextResponse.json({ error: "Неверный склад назначения." }, { status: 400 });
  }

  const entries = await prisma.dropItem.findMany({ where: { id: { in: entryIds } } });
  if (entries.length !== entryIds.length || entries.some((e) => e.status === "Продано")) {
    return NextResponse.json({ error: "Часть предметов уже продана или не найдена." }, { status: 409 });
  }

  await prisma.dropItem.updateMany({
    where: { id: { in: entryIds } },
    data: { warehouse },
  });

  return NextResponse.json({ ok: true });
}
