import { prisma } from "@/lib/prisma";
import { getActivePeriodId } from "@/lib/period";

/**
 * Запись выплат в журнал и казну. Отдельно от src/lib/payout.ts — там даты
 * выплатного цикла (15→15), здесь сами проводки.
 */

export const PAYOUT_CATEGORIES = ["Прайм", "Мини-РБ"] as const;
export type PayoutCategory = (typeof PAYOUT_CATEGORIES)[number];

/**
 * Куда записывать выплату.
 *
 * Для текущего периода — в живую казну, как и раньше. Для закрытого
 * (архивного) периода — в книги САМОГО архива: операция создаётся сразу с
 * archiveId, поэтому живые расчёты (у них везде archiveId: null) её не видят.
 * Иначе выплата за прошлый период списывала бы золото из казны нового — то
 * есть люди, отходившие текущий период, недосчитались бы своей доли.
 */
export type PayoutTarget = {
  key: string;
  periodId: string | null;
  archiveId: string | null;
};

export async function resolvePayoutTarget(
  archiveId: string | null,
): Promise<PayoutTarget | null> {
  if (!archiveId) {
    const period = await getActivePeriodId();
    return { key: period, periodId: period, archiveId: null };
  }
  const archive = await prisma.archive.findUnique({
    where: { id: archiveId },
    select: { id: true },
  });
  if (!archive) return null;
  // Ключом периода для Payment служит id архива — так выплаты за закрытый
  // период не смешиваются с выплатами за текущий.
  return { key: archive.id, periodId: null, archiveId: archive.id };
}

/** Сумма доли: из снимка архива, из снимка ЗП за период, либо живой расчёт. */
export async function resolvePayoutAmount(
  playerId: string,
  category: PayoutCategory,
  target: PayoutTarget,
): Promise<number | null> {
  if (target.archiveId) {
    const stat = await prisma.archivePlayerStat.findFirst({
      where: { archiveId: target.archiveId, playerId },
    });
    if (!stat) return null;
    return category === "Мини-РБ" ? stat.salaryMiniRb : stat.salaryPrime;
  }

  // Живой расчёт. Фиксировать зарплату отдельной кнопкой больше не нужно:
  // доли считаются от исходного фонда периода, а не от остатка казны, и от
  // чужих выплат уже не зависят (см. distributionPools в queries.ts).
  const { getPlayerById } = await import("@/lib/queries");
  const player = await getPlayerById(playerId);
  if (!player) return null;
  return category === "Мини-РБ" ? player.salaryMiniRb : player.salaryPrime;
}

/**
 * Отмечает долю выплаченной: запись в Журнал выплат + расходная операция в
 * казне того же периода. Обе записи одной транзакцией — журнал без списания
 * (или наоборот) развалил бы сверку.
 */
export async function recordPayout({
  playerId,
  playerName,
  category,
  amount,
  target,
}: {
  playerId: string;
  playerName: string;
  category: PayoutCategory;
  amount: number;
  target: PayoutTarget;
}) {
  return prisma.$transaction(async (tx) => {
    await tx.appSetting.upsert({
      where: { key: "xd:payout-lock" },
      create: { key: "xd:payout-lock", value: "1" },
      update: { value: "1" },
    });
    const existing = await tx.payment.findFirst({
      where: {
        playerId,
        category,
        source: "payout",
        archiveMonth: target.key,
        status: "Выплачено",
      },
    });
    if (existing) return { repeated: true, amount: existing.amount };
    await tx.payment.create({
      data: {
        playerId,
        amount,
        status: "Выплачено",
        source: "payout",
        archiveMonth: target.key,
        periodId: target.periodId,
        category,
      },
    });
    await tx.treasuryTransaction.create({
      data: {
        description: `Выплата ЗП (${category}): ${playerName}`,
        amount: -amount,
        category,
        kind: "payout",
        periodId: target.periodId,
        archiveId: target.archiveId,
      },
    });
    return { repeated: false, amount };
  });
}

/**
 * Возвращает долю в «Ожидает»: удаляет запись журнала и компенсирующей
 * операцией возвращает сумму в ту же казну, из которой она была списана.
 */
export async function cancelPayout({
  paymentId,
  playerName,
  category,
  amount,
  target,
}: {
  paymentId: string;
  playerName: string;
  category: PayoutCategory;
  amount: number;
  target: PayoutTarget;
}) {
  return prisma.$transaction(async (tx) => {
    await tx.appSetting.upsert({
      where: { key: "xd:payout-lock" },
      create: { key: "xd:payout-lock", value: "1" },
      update: { value: "1" },
    });
    const existing = await tx.payment.findUnique({ where: { id: paymentId } });
    if (!existing || existing.status !== "Выплачено") return { repeated: true };
    if (
      existing.amount !== amount ||
      existing.category !== category ||
      existing.archiveMonth !== target.key
    )
      throw new Error("Выплата изменилась. Обновите страницу.");
    await tx.payment.update({
      where: { id: paymentId },
      data: { status: "Отменено" },
    });
    await tx.treasuryTransaction.create({
      data: {
        description: `Отмена выплаты ЗП (${category}): ${playerName}`,
        amount: existing.amount,
        category,
        kind: "payout",
        periodId: target.periodId,
        archiveId: target.archiveId,
      },
    });
    return { repeated: false };
  });
}
