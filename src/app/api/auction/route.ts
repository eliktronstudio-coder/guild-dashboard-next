import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser, requireAdmin } from "@/lib/auth";
import { adjustTimer, finishAuction, getActiveAuction, startAuction } from "@/lib/auction";

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
  // durationSec отсутствует или null — торги без таймера, до ручного завершения.
  const rawDuration = body?.durationSec;
  const durationSec = rawDuration === null || rawDuration === undefined ? null : Number(rawDuration);
  if (durationSec !== null && (!Number.isFinite(durationSec) || durationSec <= 0)) {
    return NextResponse.json({ error: "Некорректная длительность торгов." }, { status: 400 });
  }

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
    durationSec,
    createdBy: admin.username,
  });

  return NextResponse.json({ ok: true, auctionId: auction.id });
}

/**
 * Правка таймера идущих торгов — только ГМ и админ.
 *
 * deltaSec — добавить/снять время, durationSec — задать остаток заново,
 * durationSec: null — убрать ограничение времени.
 */
export async function PATCH(request: NextRequest) {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: "Нет доступа." }, { status: 403 });

  const body = await request.json().catch(() => null);
  const hasDelta = typeof body?.deltaSec === "number" && Number.isFinite(body.deltaSec);
  const hasDuration = body?.durationSec === null || (typeof body?.durationSec === "number" && Number.isFinite(body.durationSec));
  if (!hasDelta && !hasDuration) {
    return NextResponse.json({ error: "Укажите, как изменить время." }, { status: 400 });
  }

  const updated = await adjustTimer(
    hasDuration ? { durationSec: body.durationSec } : { deltaSec: body.deltaSec }
  );
  if (!updated) return NextResponse.json({ error: "Активных торгов нет." }, { status: 404 });

  return NextResponse.json({ ok: true });
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
