import type { Prisma } from "@/generated/prisma/client";

/**
 * Правка состава активности и отметки полного участия.
 *
 * Вынесено из маршрута отдельно, чтобы это можно было проверить тестами:
 * раньше правка состава удаляла все строки ActivityParticipant и создавала
 * их заново, из-за чего отметка «полное участие» слетала при любой следующей
 * правке ростера — даже если сам игрок из состава не уходил.
 */

/** Диф вместо "удалить всё и создать заново" — сохраняет прочие поля строки. */
export async function applyRosterDiff(
  tx: Prisma.TransactionClient,
  activityId: string,
  nextParticipantIds: string[]
) {
  const existing = await tx.activityParticipant.findMany({
    where: { activityId },
    select: { playerId: true },
  });
  const existingIds = new Set(existing.map((e) => e.playerId));
  const nextIds = new Set(nextParticipantIds);

  const toRemove = [...existingIds].filter((pid) => !nextIds.has(pid));
  const toAdd = [...nextIds].filter((pid) => !existingIds.has(pid));

  if (toRemove.length > 0) {
    await tx.activityParticipant.deleteMany({ where: { activityId, playerId: { in: toRemove } } });
  }
  if (toAdd.length > 0) {
    await tx.activityParticipant.createMany({
      data: toAdd.map((playerId) => ({ activityId, playerId })),
    });
  }

  return { added: toAdd, removed: toRemove, kept: [...existingIds].filter((pid) => nextIds.has(pid)) };
}

/** Отмечает полное участие ровно тем, кто в списке; остальным из состава снимает. */
export async function applyFullParticipation(
  tx: Prisma.TransactionClient,
  activityId: string,
  fullParticipantIds: string[]
) {
  const fullSet = new Set(fullParticipantIds);
  const current = await tx.activityParticipant.findMany({
    where: { activityId },
    select: { playerId: true },
  });
  await Promise.all(
    current.map((c) =>
      tx.activityParticipant.updateMany({
        where: { activityId, playerId: c.playerId },
        data: { fullParticipation: fullSet.has(c.playerId) },
      })
    )
  );
}
