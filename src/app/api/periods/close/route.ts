import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/auth";
import { getActivePeriod, computePeriodBounds, periodLabel } from "@/lib/period";
import { getAllPlayers, getTreasuryBreakdown } from "@/lib/queries";

/**
 * Сводка для подтверждения перед архивацией (п.16/37 ТЗ): показывает, что
 * попадёт в архив, и предупреждает об отрицательном балансе казны — если он
 * отрицательный, закрытие блокируется тем же способом, что и в POST ниже.
 */
export async function GET() {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: "Нет доступа." }, { status: 403 });

  const active = await getActivePeriod();
  const [players, treasury, activityCount, unsoldDrops] = await Promise.all([
    getAllPlayers(),
    getTreasuryBreakdown(),
    prisma.activity.count({ where: { periodId: active.id } }),
    prisma.dropItem.count({ where: { status: "Не продано" } }),
  ]);
  const payable = players.filter((p) => p.salaryPrime > 0 || p.salaryMiniRb > 0);
  const totalDebtIfClosedNow = payable.reduce((sum, p) => sum + p.salaryPrime + p.salaryMiniRb, 0);

  return NextResponse.json({
    period: { id: active.id, label: active.label },
    activityCount,
    unsoldDrops,
    treasuryPrime: treasury.prime,
    treasuryMiniRb: treasury.miniRb,
    playersWithDebt: payable.length,
    totalDebtIfClosedNow,
    negativeBalance: treasury.prime < 0 || treasury.miniRb < 0,
  });
}

/**
 * «Архивировать период»: замораживает текущий расчётный период в
 * ArchiveSnapshot (по одной строке на игрока — начислено/выплачено на
 * момент закрытия), помечает период status="closed" и сразу создаёт
 * следующий 15→15 цикл как новый активный период.
 *
 * Казна НЕ обнуляется — TreasuryTransaction продолжают накапливаться как
 * прежде, просто новые операции помечаются periodId нового периода.
 * Задолженность (accrued - paid) остаётся доступной к погашению через
 * /api/archive/[periodId]/pay, списывающий из ТЕКУЩЕЙ казны.
 */
export async function POST() {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: "Нет доступа." }, { status: 403 });

  const active = await getActivePeriod();
  if (active.status !== "active") {
    return NextResponse.json({ error: "Нет активного периода для архивации." }, { status: 409 });
  }

  // Блокируем архивацию при отрицательном балансе — п.37/38 ТЗ: "нет ли
  // отрицательного баланса". Долг игрокам сам по себе архивации не мешает —
  // он ожидаемо переходит в задолженность архива.
  const treasuryCheck = await getTreasuryBreakdown();
  if (treasuryCheck.prime < 0 || treasuryCheck.miniRb < 0) {
    return NextResponse.json(
      { error: "Отрицательный баланс казны — архивация запрещена, пока баланс не будет исправлен." },
      { status: 409 }
    );
  }

  const players = await getAllPlayers();

  const paidRows = await prisma.payment.groupBy({
    by: ["playerId", "category"],
    where: { periodId: active.id, source: "payout", status: "Выплачено", category: { not: null } },
    _sum: { amount: true },
  });
  const paidMap = new Map<string, number>();
  for (const r of paidRows) {
    paidMap.set(`${r.playerId}:${r.category}`, r._sum.amount ?? 0);
  }

  const snapshotRows = players
    .map((p) => {
      const paidPrime = paidMap.get(`${p.id}:Прайм`) ?? 0;
      const paidMiniRb = paidMap.get(`${p.id}:Мини-РБ`) ?? 0;
      const accruedPrime = p.salaryPrime + paidPrime;
      const accruedMiniRb = p.salaryMiniRb + paidMiniRb;
      return { playerId: p.id, playerName: p.name, accruedPrime, accruedMiniRb, paidPrime, paidMiniRb };
    })
    .filter((r) => r.accruedPrime > 0 || r.accruedMiniRb > 0);

  const { startDate: nextStart, endDate: nextEnd } = computePeriodBounds(active.endDate);

  const [, , newPeriod] = await prisma.$transaction([
    prisma.archiveSnapshot.deleteMany({ where: { periodId: active.id } }),
    snapshotRows.length > 0
      ? prisma.archiveSnapshot.createMany({ data: snapshotRows.map((r) => ({ periodId: active.id, ...r })) })
      : prisma.archiveSnapshot.createMany({ data: [] }),
    prisma.accountingPeriod.create({
      data: { startDate: nextStart, endDate: nextEnd, label: periodLabel(nextStart, nextEnd), status: "active" },
    }),
  ]);

  await prisma.accountingPeriod.update({
    where: { id: active.id },
    data: { status: "closed", closedAt: new Date(), closedBy: admin.username },
  });

  return NextResponse.json({ ok: true, closedPeriodId: active.id, newPeriodId: newPeriod.id, players: snapshotRows.length });
}
