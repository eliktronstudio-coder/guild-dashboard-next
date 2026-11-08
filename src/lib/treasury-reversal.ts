import type { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";
export class ReversalError extends Error {
  constructor(
    message: string,
    public status = 409,
  ) {
    super(message);
  }
}
/** Preserve the original ledger entry, compensate once, and restore linked stock atomically. */
export async function reverseTreasuryTransaction(id: string) {
  return prisma.$transaction((tx) => reverseTreasuryTransactionInTx(tx, id));
}
export async function reverseTreasuryTransactionInTx(
  tx: Prisma.TransactionClient,
  id: string,
) {
  await tx.appSetting.upsert({
    where: { key: "xd:sales-lock" },
    create: { key: "xd:sales-lock", value: "1" },
    update: { value: "1" },
  });
  const original = await tx.treasuryTransaction.findUnique({ where: { id } });
  if (!original) throw new ReversalError("Операция не найдена.", 404);
  if (original.archiveId)
    throw new ReversalError("Архивные операции доступны только для чтения.");
  if (original.kind === "payout")
    throw new ReversalError("Используйте отмену выплаты в расчёте периода.");
  if (original.reversalOfId)
    throw new ReversalError("Обратную операцию нельзя отменить повторно.");
  const prior = await tx.treasuryTransaction.findUnique({
    where: { reversalOfId: id },
  });
  if (prior) return { ok: true, repeated: true };
  // Do not remove money already used for salaries; cancel the payouts first.
  if (original.amount > 0) {
    const paid = await tx.treasuryTransaction.aggregate({
      where: { archiveId: null, kind: "payout" },
      _sum: { amount: true },
    });
    if ((paid._sum.amount ?? 0) < 0)
      throw new ReversalError(
        "Сначала отмените выплаты из этого фонда. История должна остаться согласованной.",
      );
  }
  await tx.treasuryTransaction.create({
    data: {
      description: "Отмена: " + original.description,
      amount: -original.amount,
      category: original.category,
      kind: original.kind,
      periodId: original.periodId,
      reversalOfId: original.id,
    },
  });
  await tx.dropItem.updateMany({
    where: { treasuryTransactionId: id, status: "Продано" },
    data: {
      status: "Не продано",
      treasuryTransactionId: null,
      playerId: null,
    },
  });
  return { ok: true, repeated: false };
}
