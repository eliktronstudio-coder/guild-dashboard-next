import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/auth";

const MAX_IMAGE_BYTES = 800_000;

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: "Нет доступа." }, { status: 403 });

  const { id } = await params;
  const body = await request.json().catch(() => null);
  const data: { name?: string; imageUrl?: string } = {};

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
