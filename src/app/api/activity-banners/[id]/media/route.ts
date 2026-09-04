import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";

/**
 * Отдаёт тело баннера (картинка/GIF/MP4) напрямую по HTTP, а не через React-
 * пропсы: если передавать base64 как проп клиентского компонента, Next
 * встраивает те же байты в hydration-payload ПОВЕРХ уже отрендеренного HTML —
 * страница со страницы со списком активностей раздувалась до 40+ МБ. Обычный
 * <img>/<video src> браузер запрашивает и кэширует как любой другой файл.
 */
export async function GET(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (!user) return new NextResponse(null, { status: 401 });

  const { id } = await params;
  const banner = await prisma.activityBanner.findUnique({ where: { id }, select: { imageUrl: true } });
  if (!banner) return new NextResponse(null, { status: 404 });

  const match = banner.imageUrl.match(/^data:([^;]+);base64,([\s\S]*)$/);
  if (!match) return new NextResponse(null, { status: 500 });
  const [, mediaType, base64] = match;

  return new NextResponse(Buffer.from(base64, "base64"), {
    headers: {
      "Content-Type": mediaType,
      // Баннер может обновиться под тем же id (мы так и делаем), поэтому не
      // помечаем immutable — час кэша достаточно, чтобы не гонять видео на
      // каждую навигацию, и не держит устаревшую версию слишком долго.
      "Cache-Control": "private, max-age=3600",
    },
  });
}
