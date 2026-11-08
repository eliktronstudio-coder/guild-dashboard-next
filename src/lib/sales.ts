import { createHash } from "node:crypto";
import { prisma } from "@/lib/prisma";
import { getActivePeriodId } from "@/lib/period";

export class SaleError extends Error {
  constructor(
    message: string,
    public status = 400,
  ) {
    super(message);
  }
}
type SaleInput = {
  miniRb?: boolean;
  junk?: boolean;
  xp?: number;
  note?: string;
  quantity?: number;
  amount?: number;
  playerId?: string;
  entryIds?: string[];
};
function integer(value: unknown, minimum = 0) {
  return (
    typeof value === "number" &&
    Number.isSafeInteger(value) &&
    value >= minimum &&
    value <= 2_000_000_000
  );
}

/** Durable idempotency + inventory recheck share the same SQLite write transaction. */
export async function sellInventory(
  input: SaleInput,
  userId: string,
  requestId: string,
) {
  if (!/^[a-zA-Z0-9-]{16,80}$/.test(requestId))
    throw new SaleError("Нужен ключ повторной отправки. Обновите форму.");
  if (!input || typeof input !== "object")
    throw new SaleError("Некорректная продажа.");
  const key = `sale:${userId}:${requestId}`;
  const fingerprint = createHash("sha256")
    .update(JSON.stringify(input))
    .digest("hex");
  const periodId = await getActivePeriodId();
  return prisma.$transaction(async (tx) => {
    // First statement obtains the SQLite write lock before reading stock.
    await tx.appSetting.upsert({
      where: { key: "xd:sales-lock" },
      create: { key: "xd:sales-lock", value: "1" },
      update: { value: "1" },
    });
    const stored = await tx.appSetting.findUnique({ where: { key } });
    if (stored) {
      const prior = JSON.parse(stored.value) as {
        fingerprint: string;
        transactionId: string;
      };
      if (prior.fingerprint !== fingerprint)
        throw new SaleError("Ключ уже использован для другой продажи.", 409);
      return { ok: true, transactionId: prior.transactionId, repeated: true };
    }
    const playerId =
      typeof input.playerId === "string" && input.playerId
        ? input.playerId
        : null;
    const buyer = playerId
      ? await tx.player.findUnique({ where: { id: playerId } })
      : null;
    if (playerId && !buyer) throw new SaleError("Игрок не найден.", 404);
    let amount: number;
    let description: string;
    let category: string | null = null;
    const consume: { id: string; take: number; quantity: number }[] = [];
    let entries: Awaited<ReturnType<typeof tx.dropItem.findMany>> = [];
    if (input.miniRb === true || input.junk === true) {
      if (
        !integer(input.amount) ||
        !integer(input.miniRb ? input.xp : input.quantity, 1)
      )
        throw new SaleError(
          "Укажите целое количество и сумму от 0 до 2 000 000 000.",
        );
      amount = input.amount!;
      category = input.miniRb ? "Мини-РБ" : null;
      description = input.miniRb
        ? `Продажа Мини-РБ: ${input.xp} опыта${typeof input.note === "string" ? " — " + input.note.slice(0, 120) : ""}`
        : `Продажа дропа: Мусор ×${input.quantity} — ${buyer?.name ?? "аукцион"}`;
    } else {
      if (
        !Array.isArray(input.entryIds) ||
        !input.entryIds.length ||
        input.entryIds.length > 200 ||
        input.entryIds.some((id) => typeof id !== "string") ||
        new Set(input.entryIds).size !== input.entryIds.length ||
        !integer(input.quantity, 1)
      )
        throw new SaleError("Выберите предмет и корректное целое количество.");
      entries = await tx.dropItem.findMany({
        where: { id: { in: input.entryIds } },
        orderBy: [{ date: "desc" }, { id: "asc" }],
      });
      if (
        entries.length !== input.entryIds.length ||
        entries.some(
          (entry) => entry.status !== "Не продано" || entry.warehouse !== "ХД",
        ) ||
        new Set(entries.map((e) => e.item)).size !== 1
      )
        throw new SaleError(
          "Предмет уже продан, перемещён или список устарел.",
          409,
        );
      let remaining = input.quantity!;
      let fixed = 0;
      for (const entry of entries) {
        const take = Math.min(remaining, entry.quantity);
        if (take > 0) {
          consume.push({ id: entry.id, take, quantity: entry.quantity });
          fixed += take * entry.value;
          remaining -= take;
        }
      }
      if (remaining > 0)
        throw new SaleError("В инвентаре нет столько единиц.", 409);
      amount = buyer ? fixed : input.amount!;
      if (!integer(amount))
        throw new SaleError("Нужна целая сумма от 0 до 2 000 000 000.");
      description = `Продажа дропа: ${entries[0].item} — ${buyer?.name ?? "аукцион"}`;
    }
    const transaction = await tx.treasuryTransaction.create({
      data: { amount, description, category, periodId },
    });
    for (const consumed of consume) {
      const entry = entries.find((e) => e.id === consumed.id)!;
      const changed = await tx.dropItem.updateMany({
        where: {
          id: entry.id,
          status: "Не продано",
          quantity: consumed.quantity,
          warehouse: "ХД",
        },
        data:
          consumed.take === entry.quantity
            ? {
                status: "Продано",
                playerId,
                treasuryTransactionId: transaction.id,
              }
            : { quantity: entry.quantity - consumed.take },
      });
      if (changed.count !== 1)
        throw new SaleError("Остаток изменился. Обновите страницу.", 409);
      if (consumed.take < entry.quantity)
        await tx.dropItem.create({
          data: {
            item: entry.item,
            value: entry.value,
            quantity: consumed.take,
            status: "Продано",
            date: entry.date,
            activityId: entry.activityId,
            catalogItemId: entry.catalogItemId,
            warehouse: entry.warehouse,
            category: entry.category,
            playerId,
            treasuryTransactionId: transaction.id,
          },
        });
    }
    await tx.appSetting.create({
      data: {
        key,
        value: JSON.stringify({ fingerprint, transactionId: transaction.id }),
      },
    });
    return { ok: true, transactionId: transaction.id, repeated: false };
  });
}
