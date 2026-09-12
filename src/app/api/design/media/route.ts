import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

/** Разрешённые типы: только изображения, которые браузер умеет показывать. */
const ALLOWED_MIME = new Set(["image/png", "image/jpeg", "image/webp", "image/gif", "image/svg+xml"]);
const MAX_BYTES = 4_000_000;

/** Список файлов медиатеки (без тел — только метаданные). */
export async function GET() {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: "Нет доступа." }, { status: 403 });

  const items = await prisma.designMedia.findMany({
    orderBy: { createdAt: "desc" },
    select: { id: true, name: true, mimeType: true, byteSize: true, width: true, height: true, createdAt: true },
  });
  return NextResponse.json({
    items: items.map((i) => ({ ...i, createdAt: i.createdAt.toISOString() })),
  });
}

/**
 * Загрузка файла. Тип и размер проверяются на сервере: доверять тому, что
 * прислал браузер, нельзя. SVG допускаем, но отдаём его с заголовками,
 * запрещающими исполнение скриптов (см. media/[id]/file).
 */
export async function POST(request: NextRequest) {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: "Нет доступа." }, { status: 403 });

  const body = (await request.json().catch(() => null)) as
    | { name?: string; dataUrl?: string; width?: number; height?: number }
    | null;

  const name = typeof body?.name === "string" ? body.name.replace(/[<>]/g, "").slice(0, 120) : "";
  const dataUrl = typeof body?.dataUrl === "string" ? body.dataUrl : "";
  if (!name || !dataUrl) return NextResponse.json({ error: "Нужны имя файла и содержимое." }, { status: 400 });

  const match = /^data:([a-z0-9/+.-]+);base64,([A-Za-z0-9+/=]+)$/i.exec(dataUrl);
  if (!match) return NextResponse.json({ error: "Файл повреждён или в неподдерживаемом формате." }, { status: 400 });

  const mimeType = match[1].toLowerCase();
  if (!ALLOWED_MIME.has(mimeType)) {
    return NextResponse.json(
      { error: "Допустимы только изображения: PNG, JPEG, WEBP, GIF, SVG." },
      { status: 400 }
    );
  }

  const byteSize = Math.floor((match[2].length * 3) / 4);
  if (byteSize > MAX_BYTES) {
    return NextResponse.json({ error: "Файл больше 4 МБ." }, { status: 413 });
  }

  const created = await prisma.designMedia.create({
    data: {
      name,
      mimeType,
      byteSize,
      width: Number.isInteger(body?.width) ? (body!.width as number) : null,
      height: Number.isInteger(body?.height) ? (body!.height as number) : null,
      dataUrl,
      createdBy: admin.username,
    },
    select: { id: true, name: true, mimeType: true, byteSize: true, width: true, height: true, createdAt: true },
  });

  return NextResponse.json({ item: { ...created, createdAt: created.createdAt.toISOString() } });
}
