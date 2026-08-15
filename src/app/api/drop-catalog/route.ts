import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/auth";

const MAX_IMAGE_BYTES = 800_000;

export async function POST(request: NextRequest) {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: "Нет доступа." }, { status: 403 });

  const body = await request.json().catch(() => null);
  const name = typeof body?.name === "string" ? body.name.trim() : "";
  const price = Number(body?.price);
  const imageUrl = typeof body?.imageUrl === "string" ? body.imageUrl : null;

  if (!name || name.length > 60) {
    return NextResponse.json({ error: "Укажите название предмета (до 60 символов)." }, { status: 400 });
  }
  if (!Number.isFinite(price) || price < 0) {
    return NextResponse.json({ error: "Укажите цену за единицу (0 или больше)." }, { status: 400 });
  }
  if (imageUrl && (!imageUrl.startsWith("data:image/") || imageUrl.length > MAX_IMAGE_BYTES)) {
    return NextResponse.json({ error: "Фото слишком большое или неверного формата (до ~600 КБ)." }, { status: 400 });
  }

  const existing = await prisma.dropCatalogItem.findUnique({ where: { name } });
  if (existing) {
    return NextResponse.json({ error: "Такой предмет уже есть в реестре." }, { status: 409 });
  }

  const item = await prisma.dropCatalogItem.create({
    data: { name, price, imageUrl },
  });

  return NextResponse.json(item, { status: 201 });
}
