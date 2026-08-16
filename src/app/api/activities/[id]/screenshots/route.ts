import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/auth";

const SCREENSHOT_KINDS = ["roster", "drop"];
const MAX_IMAGE_BYTES = 800_000;
const MAX_SCREENSHOTS_PER_KIND = 6;

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: "Нет доступа." }, { status: 403 });

  const { id } = await params;
  const body = await request.json().catch(() => null);
  const items: { kind: string; imageUrl: string }[] = Array.isArray(body?.items)
    ? body.items
        .filter((s: unknown): s is { kind: unknown; imageUrl: unknown } => typeof s === "object" && s !== null)
        .map((s: { kind: unknown; imageUrl: unknown }) => ({
          kind: typeof s.kind === "string" ? s.kind : "",
          imageUrl: typeof s.imageUrl === "string" ? s.imageUrl : "",
        }))
        .filter((s: { kind: string; imageUrl: string }) => SCREENSHOT_KINDS.includes(s.kind) && s.imageUrl)
    : [];

  if (items.length === 0) {
    return NextResponse.json({ error: "Нет файлов для загрузки." }, { status: 400 });
  }
  if (items.some((s) => !s.imageUrl.startsWith("data:image/") || s.imageUrl.length > MAX_IMAGE_BYTES)) {
    return NextResponse.json({ error: "Скрин слишком большой или неверного формата (до ~600 КБ)." }, { status: 400 });
  }

  const activity = await prisma.activity.findUnique({ where: { id }, select: { id: true } });
  if (!activity) return NextResponse.json({ error: "Активность не найдена." }, { status: 404 });

  for (const kind of SCREENSHOT_KINDS) {
    const incoming = items.filter((s) => s.kind === kind).length;
    if (incoming === 0) continue;
    const existing = await prisma.activityScreenshot.count({ where: { activityId: id, kind } });
    if (existing + incoming > MAX_SCREENSHOTS_PER_KIND) {
      return NextResponse.json({ error: `Максимум ${MAX_SCREENSHOTS_PER_KIND} скринов на раздел.` }, { status: 400 });
    }
  }

  await prisma.activityScreenshot.createMany({
    data: items.map((s) => ({ activityId: id, kind: s.kind, imageUrl: s.imageUrl })),
  });

  return NextResponse.json({ ok: true }, { status: 201 });
}
