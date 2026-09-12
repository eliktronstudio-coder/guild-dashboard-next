import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

/**
 * Примеры записей для предпросмотра шаблонных страниц (карточка активности,
 * профиль игрока): администратор выбирает, на какой записи смотреть шаблон.
 */
export async function GET(request: NextRequest) {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: "Нет доступа." }, { status: 403 });

  const kind = request.nextUrl.searchParams.get("kind");

  if (kind === "activity") {
    const rows = await prisma.activity.findMany({
      orderBy: { date: "desc" },
      take: 25,
      select: { id: true, name: true, date: true },
    });
    return NextResponse.json({
      samples: rows.map((r) => ({ id: r.id, label: `${r.name} — ${r.date.toLocaleDateString("ru-RU")}` })),
    });
  }

  if (kind === "player") {
    const rows = await prisma.player.findMany({
      orderBy: { name: "asc" },
      take: 100,
      select: { id: true, name: true, role: true },
    });
    return NextResponse.json({ samples: rows.map((r) => ({ id: r.id, label: `${r.name} — ${r.role}` })) });
  }

  return NextResponse.json({ error: "Неизвестный тип примера." }, { status: 400 });
}
