import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/auth";

const MAX_IMAGE_BYTES = 800_000;

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: "Нет доступа." }, { status: 403 });

  const { id } = await params;
  const body = await request.json().catch(() => null);
  const name = typeof body?.name === "string" ? body.name.trim() : "";
  const price = Number(body?.price);
  const imageUrl = body?.imageUrl === undefined ? undefined : body.imageUrl || null;

  if (!name || name.length > 60) {
    return NextResponse.json({ error: "Укажите название предмета (до 60 символов)." }, { status: 400 });
  }
  if (!Number.isFinite(price) || price < 0) {
    return NextResponse.json({ error: "Укажите цену за единицу (0 или больше)." }, { status: 400 });
  }
  if (imageUrl && (typeof imageUrl !== "string" || !imageUrl.startsWith("data:image/") || imageUrl.length > MAX_IMAGE_BYTES)) {
    return NextResponse.json({ error: "Фото слишком большое или неверного формата (до ~600 КБ)." }, { status: 400 });
  }

  const existing = await prisma.dropCatalogItem.findFirst({ where: { name, NOT: { id } } });
  if (existing) {
    return NextResponse.json({ error: "Такой предмет уже есть в реестре." }, { status: 409 });
  }

  const item = await prisma.dropCatalogItem.update({
    where: { id },
    data: { name, price, ...(imageUrl !== undefined ? { imageUrl } : {}) },
  });

  return NextResponse.json(item);
}

export async function DELETE(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: "Нет доступа." }, { status: 403 });

  const { id } = await params;
  await prisma.dropCatalogItem.delete({ where: { id } });

  return NextResponse.json({ ok: true });
}
