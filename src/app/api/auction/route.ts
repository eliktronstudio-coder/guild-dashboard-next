import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/auth";

export async function POST(request: NextRequest) {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: "Нет доступа." }, { status: 403 });

  const body = await request.json().catch(() => null);
  const item = typeof body?.item === "string" ? body.item.trim() : "";
  const sellerId = typeof body?.sellerId === "string" ? body.sellerId : "";
  const price = Number(body?.price);
  const endsAtStr = typeof body?.endsAt === "string" ? body.endsAt : "";

  if (!item || item.length > 60) {
    return NextResponse.json({ error: "Укажите название лота (до 60 символов)." }, { status: 400 });
  }
  if (!sellerId) {
    return NextResponse.json({ error: "Выберите продавца." }, { status: 400 });
  }
  if (!Number.isFinite(price) || price <= 0) {
    return NextResponse.json({ error: "Укажите положительную цену." }, { status: 400 });
  }
  if (!endsAtStr) {
    return NextResponse.json({ error: "Укажите время окончания." }, { status: 400 });
  }
  const endsAt = new Date(endsAtStr);
  if (Number.isNaN(endsAt.getTime())) {
    return NextResponse.json({ error: "Неверная дата окончания." }, { status: 400 });
  }

  const seller = await prisma.player.findUnique({ where: { id: sellerId } });
  if (!seller) {
    return NextResponse.json({ error: "Продавец не найден." }, { status: 404 });
  }

  const lot = await prisma.auctionLot.create({
    data: { item, sellerId, price, endsAt },
    include: { seller: true },
  });

  return NextResponse.json(lot, { status: 201 });
}
