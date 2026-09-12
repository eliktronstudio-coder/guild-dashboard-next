import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

/**
 * Отдаёт байты медиафайла.
 *
 * Публичный маршрут: файл может стоять фоном на опубликованной странице,
 * которую видят все. Поэтому здесь нет ни черновиков, ни служебных данных —
 * только само изображение.
 *
 * Тело не передаётся через пропсы компонентов: иначе Next дублировал бы
 * base64 в hydration-payload и страница раздувалась бы на мегабайты.
 */
export async function GET(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!/^[a-z0-9]{20,40}$/i.test(id)) return new NextResponse("Не найдено", { status: 404 });

  const media = await prisma.designMedia.findUnique({
    where: { id },
    select: { dataUrl: true, mimeType: true },
  });
  if (!media) return new NextResponse("Не найдено", { status: 404 });

  const comma = media.dataUrl.indexOf(",");
  if (comma < 0) return new NextResponse("Файл повреждён", { status: 500 });

  const bytes = Buffer.from(media.dataUrl.slice(comma + 1), "base64");

  return new NextResponse(new Uint8Array(bytes), {
    headers: {
      "Content-Type": media.mimeType,
      "Content-Length": String(bytes.length),
      "Cache-Control": "public, max-age=31536000, immutable",
      // SVG может содержать скрипт: запрещаем его исполнение и отдаём файл
      // как самостоятельный документ без доступа к странице.
      "Content-Security-Policy": "default-src 'none'; style-src 'unsafe-inline'; sandbox",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
