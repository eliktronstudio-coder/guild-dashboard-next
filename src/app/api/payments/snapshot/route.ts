import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/auth";
import { getActivePeriodId } from "@/lib/period";
import { getAllPlayers } from "@/lib/queries";

/**
 * Кнопка «Зарплата»: фиксирует расчётную долю каждого игрока на день
 * выплаты. Без снимка salaryPrime/salaryMiniRb пересчитываются на лету от
 * остатка казны — выплата одному игроку тут же двигала бы сумму у всех
 * остальных. После фиксации и отображение, и списание при нажатии
 * «Выплата» берут суммы отсюда, а не из живого расчёта.
 *
 * Один снимок на период (см. currentPayoutPeriod) — повторное нажатие
 * ничего не перезаписывает, чтобы уже начатая выплата не «поехала».
 */
export async function POST() {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: "Нет доступа." }, { status: 403 });

  const period = await getActivePeriodId();

  const existing = await prisma.payoutSnapshot.findFirst({ where: { period } });
  if (existing) {
    return NextResponse.json({ error: "Зарплата за этот период уже зафиксирована." }, { status: 409 });
  }

  const players = await getAllPlayers();
  const payable = players.filter((p) => p.salaryPrime > 0 || p.salaryMiniRb > 0);

  if (payable.length === 0) {
    return NextResponse.json({ error: "Нет игроков с ненулевой зарплатой." }, { status: 400 });
  }

  // SQLite-адаптер Prisma не поддерживает skipDuplicates; от гонки двойного
  // клика защищает сама уникальность (period, playerId) — второй запрос
  // упадёт на первой же строке и вернёт 500, что тоже безопасно (без строк
  // "наполовину").
  try {
    await prisma.payoutSnapshot.createMany({
      data: payable.map((p) => ({
        period,
        playerId: p.id,
        salaryPrime: p.salaryPrime,
        salaryMiniRb: p.salaryMiniRb,
      })),
    });
  } catch {
    return NextResponse.json({ error: "Зарплата за этот период уже зафиксирована." }, { status: 409 });
  }

  return NextResponse.json({ ok: true, period, count: payable.length });
}
