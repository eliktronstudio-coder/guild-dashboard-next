import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/auth";

const MAX_IMAGE_BYTES = 800_000;

const MIN_HEIGHT = 60;
const MAX_HEIGHT = 600;


/** Собственные размеры картинки, присланные при загрузке. */
function readNatural(body: unknown) {
  const raw = body as { imgWidth?: unknown; imgHeight?: unknown };
  const positive = (v: unknown) => {
    const n = Math.round(Number(v));
    return Number.isFinite(n) && n > 0 ? n : null;
  };
  return { imgWidth: positive(raw?.imgWidth), imgHeight: positive(raw?.imgHeight) };
}

/** Высота баннера в px и ширина в % от карточки; null — значения по умолчанию. */
function readSize(body: unknown) {
  const raw = body as { height?: unknown; widthPct?: unknown };
  const clamp = (v: unknown, min: number, max: number) => {
    const n = Math.round(Number(v));
    return Number.isFinite(n) ? Math.min(max, Math.max(min, n)) : null;
  };
  return {
    height: raw?.height === undefined || raw.height === null ? null : clamp(raw.height, MIN_HEIGHT, MAX_HEIGHT),
    widthPct: raw?.widthPct === undefined || raw.widthPct === null ? null : clamp(raw.widthPct, 10, 100),
  };
}


export async function POST(request: NextRequest) {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: "Нет доступа." }, { status: 403 });

  const body = await request.json().catch(() => null);
  const name = typeof body?.name === "string" ? body.name.trim() : "";
  const imageUrl = typeof body?.imageUrl === "string" ? body.imageUrl : "";

  if (!name || name.length > 60) {
    return NextResponse.json({ error: "Укажите название активности (до 60 символов)." }, { status: 400 });
  }
  if (!imageUrl.startsWith("data:image/") || imageUrl.length > MAX_IMAGE_BYTES) {
    return NextResponse.json({ error: "Фото слишком большое или неверного формата (до ~600 КБ)." }, { status: 400 });
  }

  const existing = await prisma.activityBanner.findUnique({ where: { name } });
  if (existing) {
    return NextResponse.json({ error: "Баннер для этой активности уже есть." }, { status: 409 });
  }

  const { height, widthPct } = readSize(body);
  const { imgWidth, imgHeight } = readNatural(body);
  const banner = await prisma.activityBanner.create({
    data: { name, imageUrl, height, widthPct, imgWidth, imgHeight },
  });
  return NextResponse.json(banner, { status: 201 });
}
