import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/auth";

const MAX_IMAGE_BYTES = 800_000;

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

  const banner = await prisma.activityBanner.create({ data: { name, imageUrl } });
  return NextResponse.json(banner, { status: 201 });
}
