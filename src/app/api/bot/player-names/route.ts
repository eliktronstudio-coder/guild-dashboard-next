import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

function isAuthorized(request: NextRequest) {
  const secret = process.env.BOT_API_SECRET;
  if (!secret) return false;
  return request.headers.get("authorization") === `Bearer ${secret}`;
}

/**
 * Полный список ников состава — используется как подсказка при распознавании
 * ростер-скринов: модель сверяет прочитанное с реальными никами и меньше
 * ошибается на похожих буквах (0/O, л/l, е/e и т.п.), не выдумывая опечатки.
 */
export async function GET(request: NextRequest) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ error: "Нет доступа." }, { status: 403 });
  }

  const players = await prisma.player.findMany({ select: { name: true } });
  const names = players.map((p) => p.name).sort((a, b) => a.localeCompare(b, "ru"));
  return NextResponse.json({ names });
}
