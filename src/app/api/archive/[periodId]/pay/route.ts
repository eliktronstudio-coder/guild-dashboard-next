import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/auth";
import { getActivePeriodId } from "@/lib/period";

const CATEGORIES = ["Прайм", "Мини-РБ"] as const;
type Category = (typeof CATEGORIES)[number];

/**
 * Погашение задолженности из закрытого периода. Списывает из ТЕКУЩЕЙ
 * казны (закрытый период — read-only история, не отдельный счёт), уменьшает
 * остаток в ArchiveSnapshot и создаёт обычную Payment/TreasuryTransaction
 * для сквозного журнала и «Расчёта распределения» текущего периода
 * оставались чистыми — archivePeriodId отличает такие записи явно.
 */
export async function POST(request: NextRequest, { params }: { params: Promise<{ periodId: string }> }) {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: "Нет доступа." }, { status: 403 });

  const { periodId } = await params;
  const body = await request.json().catch(() => null);
  const playerId = typeof body?.playerId === "string" ? body.playerId : "";
  const category = body?.category;
  if (!playerId || typeof category !== "string" || !CATEGORIES.includes(category as Category)) {
    return NextResponse.json({ error: "Некорректные данные." }, { status: 400 });
  }

  const snapshot = await prisma.archiveSnapshot.findUnique({
    where: { periodId_playerId: { periodId, playerId } },
  });
  if (!snapshot) return NextResponse.json({ error: "Задолженность не найдена." }, { status: 404 });

  const isPrime = category === "Прайм";
  const accrued = isPrime ? snapshot.accruedPrime : snapshot.accruedMiniRb;
  const paid = isPrime ? snapshot.paidPrime : snapshot.paidMiniRb;
  const remaining = accrued - paid;
  if (remaining <= 0) {
    return NextResponse.json({ error: "По этой категории долг уже погашен." }, { status: 400 });
  }

  const requested = body?.amount !== undefined ? Math.round(Number(body.amount)) : remaining;
  if (!Number.isFinite(requested) || requested <= 0 || requested > remaining) {
    return NextResponse.json({ error: `Сумма должна быть от 1 до ${remaining}.` }, { status: 400 });
  }

  const period = await prisma.accountingPeriod.findUnique({ where: { id: periodId } });
  if (!period) return NextResponse.json({ error: "Период не найден." }, { status: 404 });
  const currentPeriodId = await getActivePeriodId();

  await prisma.$transaction([
    prisma.archiveSnapshot.update({
      where: { periodId_playerId: { periodId, playerId } },
      data: isPrime ? { paidPrime: { increment: requested } } : { paidMiniRb: { increment: requested } },
    }),
    prisma.payment.create({
      data: {
        playerId,
        amount: requested,
        status: "Выплачено",
        source: "archive",
        category,
        periodId: currentPeriodId,
        archivePeriodId: periodId,
      },
    }),
    prisma.treasuryTransaction.create({
      data: {
        description: `Погашение долга за ${period.label} (${category}): ${snapshot.playerName}`,
        amount: -requested,
        category,
        kind: "payout",
        periodId: currentPeriodId,
      },
    }),
  ]);

  return NextResponse.json({ ok: true, paid: requested, remaining: remaining - requested });
}
