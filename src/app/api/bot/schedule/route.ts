import { NextRequest, NextResponse } from "next/server";
import { SCHEDULE } from "@/lib/schedule";

/**
 * Расписание активностей для Discord-бота.
 *
 * Бот — отдельный процесс на обычном JS и до кода сайта не достаёт. Отдаём
 * расписание сюда, чтобы источник правды остался один: правка в
 * src/lib/schedule.ts автоматически доезжает до уведомлений, без второй
 * копии времён в боте.
 *
 * Время — минуты от полуночи по МСК, день — как в JS: 0 = воскресенье.
 */
export async function GET(request: NextRequest) {
  const secret = process.env.BOT_API_SECRET;
  if (!secret || request.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Нет доступа." }, { status: 403 });
  }

  return NextResponse.json({
    slots: SCHEDULE.map((s) => ({ day: s.day, minutes: s.minutes, name: s.name })),
  });
}
