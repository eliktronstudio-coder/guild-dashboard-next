import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/auth";
import { currentPayoutPeriod } from "@/lib/payout";
import { getPlayerById } from "@/lib/queries";

const CATEGORIES = ["Прайм", "Мини-РБ"] as const;
type Category = (typeof CATEGORIES)[number];

function parseBody(body: unknown): { playerId: string; category: Category } | null {
  const playerId = typeof (body as { playerId?: unknown })?.playerId === "string" ? (body as { playerId: string }).playerId : "";
  const category = (body as { category?: unknown })?.category;
  if (!playerId || typeof category !== "string" || !CATEGORIES.includes(category as Category)) return null;
  return { playerId, category: category as Category };
}

/**
 * Переключатель статуса «Ожидает / Выплачено» для доли Прайма или Мини-РБ
 * конкретного игрока (строка «Расчёт распределения» на /payments).
 *
 * POST — перевести в «Выплачено»: сумма списывается из соответствующей
 * казны и переносится в Журнал выплат. Сумма фиксируется в момент нажатия
 * (текущая доля игрока), а не пересчитывается позже.
 */
export async function POST(request: NextRequest) {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: "Нет доступа." }, { status: 403 });

  const parsed = parseBody(await request.json().catch(() => null));
  if (!parsed) return NextResponse.json({ error: "Некорректные данные." }, { status: 400 });
  const { playerId, category } = parsed;

  const period = currentPayoutPeriod();

  const already = await prisma.payment.findFirst({
    where: { playerId, category, source: "payout", archiveMonth: period, status: "Выплачено" },
  });
  if (already) {
    return NextResponse.json({ error: "За этот период уже выплачено." }, { status: 409 });
  }

  // Сумму берём из текущего расчёта зарплаты игрока (salaryPrime/salaryMiniRb),
  // а не из тела запроса — иначе с клиента можно было бы прислать любую цифру.
  const player = await getPlayerById(playerId);
  if (!player) return NextResponse.json({ error: "Игрок не найден." }, { status: 404 });

  const amount = category === "Мини-РБ" ? player.salaryMiniRb : player.salaryPrime;
  if (amount <= 0) {
    return NextResponse.json({ error: "Нечего выплачивать — доля равна нулю." }, { status: 400 });
  }

  await prisma.$transaction([
    prisma.payment.create({
      data: {
        playerId,
        amount,
        status: "Выплачено",
        source: "payout",
        archiveMonth: period,
        category,
      },
    }),
    prisma.treasuryTransaction.create({
      data: {
        description: `Выплата ЗП (${category}): ${player.name}`,
        amount: -amount,
        category,
        kind: "payout",
      },
    }),
  ]);

  return NextResponse.json({ ok: true, amount });
}

/**
 * DELETE — вернуть в «Ожидает»: отменяет выплату, найденную по игроку,
 * категории и текущему периоду, и компенсирующей операцией возвращает
 * сумму в казну.
 */
export async function DELETE(request: NextRequest) {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: "Нет доступа." }, { status: 403 });

  const parsed = parseBody(await request.json().catch(() => null));
  if (!parsed) return NextResponse.json({ error: "Некорректные данные." }, { status: 400 });
  const { playerId, category } = parsed;

  const period = currentPayoutPeriod();

  const payment = await prisma.payment.findFirst({
    where: { playerId, category, source: "payout", archiveMonth: period, status: "Выплачено" },
    include: { player: true },
  });
  if (!payment) {
    return NextResponse.json({ error: "Выплата за этот период не найдена." }, { status: 404 });
  }

  await prisma.$transaction([
    prisma.payment.delete({ where: { id: payment.id } }),
    prisma.treasuryTransaction.create({
      data: {
        description: `Отмена выплаты ЗП (${category}): ${payment.player.name}`,
        amount: payment.amount,
        category,
        kind: "payout",
      },
    }),
  ]);

  return NextResponse.json({ ok: true });
}
