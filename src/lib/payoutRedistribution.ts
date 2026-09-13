import type { Prisma } from "@/generated/prisma/client";
import { splitProportionally } from "./proportionalSplit";

/**
 * Перераспределение начисленных выплат удаляемого игрока.
 *
 * Зачем это нужно. Зарплата считается на лету из посещаемости и казны,
 * поэтому пока месяц не заархивирован, удаление игрока ничего не теряет:
 * его вес просто исчезает из расчёта, и доли остальных сразу вырастают.
 *
 * Но при архивации суммы месяца замораживаются в записях Payment. Дальше
 * удаление игрока каскадом сносило его записи, и эти деньги пропадали:
 * архив за месяц повторно не создаётся, а значит никому не доставались.
 *
 * Здесь мы забираем его неоплаченные начисления и раздаём тем, кто делил
 * с ним тот же месяц, пропорционально их собственным начислениям. Эти
 * пропорции уже содержат посещаемость и коэффициент того месяца, поэтому
 * они точнее, чем пересчёт по сегодняшней посещаемости.
 *
 * Уже выплаченное («Выплачено») не трогаем: это золото реально ушло из
 * гильдии, возвращать нечего.
 */

/** Статусы, деньги по которым ещё не покинули гильдию. */
const PENDING_STATUSES = ["Ожидает", "Подтверждено"];

export type RedistributionResult = {
  /** Сколько золота перераспределено. */
  movedGold: number;
  /** Сколько выплат получателей изменено. */
  updatedPayments: number;
  /** Месяцы, по которым прошло перераспределение. */
  months: string[];
  /** Начисления, которые вернуть было некому. */
  orphanedGold: number;
};

/**
 * Возвращает деньги удаляемого игрока остальным участникам тех же месяцев.
 * Вызывается внутри транзакции — до удаления игрока.
 */
export async function redistributePlayerPayments(
  tx: Prisma.TransactionClient,
  playerId: string
): Promise<RedistributionResult> {
  const pending = await tx.payment.findMany({
    where: { playerId, status: { in: PENDING_STATUSES } },
    select: { id: true, amount: true, archiveMonth: true },
  });

  const result: RedistributionResult = { movedGold: 0, updatedPayments: 0, months: [], orphanedGold: 0 };
  if (pending.length === 0) return result;

  // Группируем по месяцу архива: каждый месяц делился отдельно, смешивать
  // их нельзя. Начисления без месяца (заведённые вручную) идут отдельной
  // группой с ключом null.
  const byMonth = new Map<string | null, number>();
  for (const p of pending) {
    byMonth.set(p.archiveMonth, (byMonth.get(p.archiveMonth) ?? 0) + p.amount);
  }

  for (const [month, amount] of byMonth) {
    if (amount <= 0) continue;

    // Получатели — остальные игроки с неоплаченными начислениями того же
    // месяца. Их текущие суммы и есть веса.
    const recipients = await tx.payment.findMany({
      where: {
        playerId: { not: playerId },
        status: { in: PENDING_STATUSES },
        archiveMonth: month,
      },
      select: { id: true, amount: true },
    });

    const eligible = recipients.filter((r) => r.amount > 0);
    if (eligible.length === 0) {
      // Раздать некому — например, удаляют последнего в месяце. Деньги
      // остаются в казне: выплаты её не списывают, поэтому они никуда не
      // делись и попадут в следующий расчёт.
      result.orphanedGold += amount;
      continue;
    }

    const shares = splitProportionally(
      eligible.map((r) => ({ item: r, weight: r.amount })),
      amount
    );

    for (const share of shares) {
      if (share.amount <= 0) continue;
      await tx.payment.update({
        where: { id: share.item.id },
        data: { amount: share.item.amount + share.amount },
      });
      result.updatedPayments += 1;
    }

    result.movedGold += amount;
    if (month) result.months.push(month);
  }

  return result;
}
