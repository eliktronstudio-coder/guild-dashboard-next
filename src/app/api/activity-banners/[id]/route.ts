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


export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: "Нет доступа." }, { status: 403 });

  const { id } = await params;
  const body = await request.json().catch(() => null);
  const data: {
    name?: string;
    imageUrl?: string;
    height?: number | null;
    widthPct?: number | null;
    imgWidth?: number | null;
    imgHeight?: number | null;
  } = {};

  if (body?.name !== undefined) {
    const name = typeof body.name === "string" ? body.name.trim() : "";
    if (!name || name.length > 60) {
      return NextResponse.json({ error: "Укажите название активности (до 60 символов)." }, { status: 400 });
    }
    const taken = await prisma.activityBanner.findUnique({ where: { name } });
    if (taken && taken.id !== id) {
      return NextResponse.json({ error: "Баннер для этой активности уже есть." }, { status: 409 });
    }
    data.name = name;
  }
  if (body?.imageUrl !== undefined) {
    const imageUrl = typeof body.imageUrl === "string" ? body.imageUrl : "";
    if (!imageUrl.startsWith("data:image/") || imageUrl.length > MAX_IMAGE_BYTES) {
      return NextResponse.json({ error: "Фото слишком большое или неверного формата (до ~600 КБ)." }, { status: 400 });
    }
    data.imageUrl = imageUrl;
    // Размеры относятся к конкретному файлу, поэтому обновляются вместе с ним.
    const natural = readNatural(body);
    data.imgWidth = natural.imgWidth;
    data.imgHeight = natural.imgHeight;
  }

  if (body?.height !== undefined || body?.widthPct !== undefined) {
    const size = readSize(body);
    if (body?.height !== undefined) data.height = size.height;
    if (body?.widthPct !== undefined) data.widthPct = size.widthPct;
  }

  const banner = await prisma.activityBanner.update({ where: { id }, data });
  return NextResponse.json(banner);
}

export async function DELETE(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: "Нет доступа." }, { status: 403 });

  const { id } = await params;
  await prisma.activityBanner.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
