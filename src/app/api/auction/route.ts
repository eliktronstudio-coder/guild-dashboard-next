import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser, requireAdmin } from "@/lib/auth";
import { finishAuction, getActiveAuction, startAuction } from "@/lib/auction";

/**
 * Состояние текущих торгов. Клиент опрашивает его раз в пару секунд, поэтому
 * ответ не кешируем — иначе участники видели бы устаревшую цену.
 */
export async function GET() {
  const user = await getCurrentUser();
  if (!user || user.role === "random") {
    return NextResponse.json({ error: "Нет доступа." }, { status: 403 });
  }

  const auction = await getActiveAuction();
  return NextResponse.json({ auction }, { headers: { "Cache-Control": "no-store" } });
}

/** Открыть торги — только ГМ и админ. */
export async function POST(request: NextRequest) {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: "Нет доступа." }, { status: 403 });

  const body = await request.json().catch(() => null);
  const catalogItemId = typeof body?.catalogItemId === "string" ? body.catalogItemId : "";
  const startingBid = Number(body?.startingBid);
  const step = Number(body?.step);

  if (!catalogItemId) return NextResponse.json({ error: "Выберите предмет." }, { status: 400 });
  if (!Number.isFinite(startingBid) || startingBid < 0) {
    return NextResponse.json({ error: "Некорректная стартовая ставка." }, { status: 400 });
  }
  if (!Number.isFinite(step) || step < 1) {
    return NextResponse.json({ error: "Шаг должен быть больше нуля." }, { status: 400 });
  }

  const item = await prisma.dropCatalogItem.findUnique({ where: { id: catalogItemId } });
  if (!item) return NextResponse.json({ error: "Предмет не найден в реестре." }, { status: 404 });

  const auction = await startAuction({
    itemName: item.name,
    itemImageUrl: item.imageUrl,
    catalogItemId: item.id,
    startingBid,
    step,
    createdBy: admin.username,
  });

  return NextResponse.json({ ok: true, auctionId: auction.id });
}

/** Завершить торги — только ГМ и админ. Лидер становится победителем. */
export async function DELETE() {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: "Нет доступа." }, { status: 403 });

  const finished = await finishAuction();
  if (!finished) return NextResponse.json({ error: "Активных торгов нет." }, { status: 404 });

  return NextResponse.json({
    ok: true,
    winner: finished.leaderName,
    amount: finished.leaderName ? finished.currentBid : 0,
  });
}
