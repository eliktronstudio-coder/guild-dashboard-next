import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/auth";
import {
  PAYOUT_CATEGORIES,
  cancelPayout,
  recordPayout,
  resolvePayoutAmount,
  resolvePayoutTarget,
  type PayoutCategory,
} from "@/lib/payoutLedger";

type Parsed = { playerId: string; category: PayoutCategory; archiveId: string | null };

function parseBody(body: unknown): Parsed | null {
  const b = body as { playerId?: unknown; category?: unknown; archiveId?: unknown };
  const playerId = typeof b?.playerId === "string" ? b.playerId : "";
  const category = b?.category;
  if (!playerId || typeof category !== "string" || !PAYOUT_CATEGORIES.includes(category as PayoutCategory)) {
    return null;
  }
  return {
    playerId,
    category: category as PayoutCategory,
    archiveId: typeof b?.archiveId === "string" && b.archiveId ? b.archiveId : null,
  };
}

/**
 * Переключатель статуса «Ожидает / Выплачено» для доли Прайма или Мини-РБ
 * конкретного игрока (строка «Расчёт распределения» на /payments).
 *
 * POST — перевести в «Выплачено»: сумма списывается из казны того периода, за
 * который платим (текущего или закрытого), и переносится в Журнал выплат.
 * Сама механика — в src/lib/payoutLedger.ts, общая с тестами.
 */
export async function POST(request: NextRequest) {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: "Нет доступа." }, { status: 403 });

  const parsed = parseBody(await request.json().catch(() => null));
  if (!parsed) return NextResponse.json({ error: "Некорректные данные." }, { status: 400 });
  const { playerId, category, archiveId } = parsed;

  const target = await resolvePayoutTarget(archiveId);
  if (!target) return NextResponse.json({ error: "Период не найден." }, { status: 404 });

  const already = await prisma.payment.findFirst({
    where: { playerId, category, source: "payout", archiveMonth: target.key, status: "Выплачено" },
  });
  if (already) {
    return NextResponse.json({ error: "За этот период уже выплачено." }, { status: 409 });
  }

  const player = await prisma.player.findUnique({ where: { id: playerId }, select: { name: true } });
  if (!player) return NextResponse.json({ error: "Игрок не найден." }, { status: 404 });

  const amount = await resolvePayoutAmount(playerId, category, target);
  if (amount === null) return NextResponse.json({ error: "Игрок не найден в этом периоде." }, { status: 404 });
  if (amount <= 0) {
    return NextResponse.json({ error: "Нечего выплачивать — доля равна нулю." }, { status: 400 });
  }

  await recordPayout({ playerId, playerName: player.name, category, amount, target });

  return NextResponse.json({ ok: true, amount });
}

/**
 * DELETE — вернуть в «Ожидает»: отменяет выплату, найденную по игроку,
 * категории и периоду, и компенсирующей операцией возвращает сумму в ту же
 * казну, из которой она была списана (живую или архивную).
 */
export async function DELETE(request: NextRequest) {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: "Нет доступа." }, { status: 403 });

  const parsed = parseBody(await request.json().catch(() => null));
  if (!parsed) return NextResponse.json({ error: "Некорректные данные." }, { status: 400 });
  const { playerId, category, archiveId } = parsed;

  const target = await resolvePayoutTarget(archiveId);
  if (!target) return NextResponse.json({ error: "Период не найден." }, { status: 404 });

  const payment = await prisma.payment.findFirst({
    where: { playerId, category, source: "payout", archiveMonth: target.key, status: "Выплачено" },
    include: { player: true },
  });
  if (!payment) {
    return NextResponse.json({ error: "Выплата за этот период не найдена." }, { status: 404 });
  }

  await cancelPayout({
    paymentId: payment.id,
    playerName: payment.player.name,
    category,
    amount: payment.amount,
    target,
  });

  return NextResponse.json({ ok: true });
}
