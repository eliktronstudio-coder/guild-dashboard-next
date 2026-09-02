import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { SCHEDULE } from "@/lib/schedule";

/** Discord не показывает больше 25 вариантов в одном списке. */
const MAX_NAMES = 25;

function isAuthorized(request: NextRequest) {
  const secret = process.env.BOT_API_SECRET;
  if (!secret) return false;
  return request.headers.get("authorization") === `Bearer ${secret}`;
}

/**
 * Канонический список названий активностей для бота. Источники — расписание
 * (фиксированная ротация) и заведённые баннеры: и то и другое ведётся вручную,
 * поэтому в списке оказывается ровно то, что гильдия действительно проводит.
 */
export async function GET(request: NextRequest) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ error: "Нет доступа." }, { status: 403 });
  }

  const banners = await prisma.activityBanner.findMany({ select: { name: true } });
  const seen = new Map<string, string>();
  for (const name of [...SCHEDULE.map((s) => s.name), ...banners.map((b) => b.name)]) {
    const key = name.trim().toLowerCase();
    if (key && !seen.has(key)) seen.set(key, name.trim());
  }

  const names = [...seen.values()].sort((a, b) => a.localeCompare(b, "ru")).slice(0, MAX_NAMES);
  return NextResponse.json({ names });
}
