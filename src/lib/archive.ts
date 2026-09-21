import { computeAttendanceMaps } from "@/lib/attendance";
import type { Prisma } from "@/generated/prisma/client";

/**
 * Архивация за диапазон дат — одной функцией, чтобы у маршрута и у тестов
 * была общая реализация. Раньше тесты повторяли шаги архивации вручную, и
 * любое изменение маршрута они бы уже не проверяли.
 *
 * Вызывать строго внутри prisma.$transaction: снимок состава обязан быть
 * согласован с тем набором активностей, который только что уехал в архив.
 */
export async function createArchiveInTx(
  tx: Prisma.TransactionClient,
  { dateFrom, dateTo, label, createdBy }: { dateFrom: Date; dateTo: Date; label: string; createdBy?: string | null }
) {
  const dateWhere = { gte: dateFrom, lte: dateTo };

  const created = await tx.archive.create({
    data: { dateFrom, dateTo, label, createdBy: createdBy ?? null },
  });

  await tx.activity.updateMany({
    where: { date: dateWhere, archiveId: null },
    data: { archiveId: created.id },
  });

  // Выплаты ЗП (kind="payout") архивируем ВСЕ, какая бы дата у них ни стояла —
  // не только попавшие в выбранный диапазон. Выплата обычно делается через
  // день-два ПОСЛЕ дня, когда пришёл доход, из которого она списана (казна —
  // общий пул, не привязана к конкретной продаже), так что если архивировать
  // только доход по датам, а выплату по нему оставить "живой",
  // Прайм/Мини-РБ/Гильдия разъезжаются: пул дохода обнуляется, а расход
  // остаётся его вычитать — получается фиктивный отрицательный Прайм и
  // "лишнее" золото в Казне Гильдии на пустом месте. На момент архивации вся
  // уже сделанная выплата — закрытая книга старого периода.
  await tx.treasuryTransaction.updateMany({
    where: { archiveId: null, OR: [{ date: dateWhere }, { kind: "payout" }] },
    data: { archiveId: created.id },
  });

  await snapshotRosterInTx(tx, created.id);

  return created;
}

/**
 * Снимок состава с процентами посещаемости на момент архивации.
 *
 * Именно снимок, а не расчёт на лету при открытии архива: посещаемость
 * считается от участий (ActivityParticipant), а они каскадно удаляются вместе
 * с игроком. Без фиксации достаточно было бы убрать человека из состава — и он
 * бесследно исчез бы из уже закрытого архива вместе со своими процентами.
 */
export async function snapshotRosterInTx(tx: Prisma.TransactionClient, archiveId: string) {
  const archived = await tx.activity.findMany({
    where: { archiveId },
    select: { name: true, category: true, mode: true, weight: true, participants: { select: { playerId: true } } },
  });
  const maps = computeAttendanceMaps(archived);

  // Берём весь текущий состав, а не только участников: тот, кто за период не
  // сходил никуда, обязан попасть в архив с честным 0% — иначе «состав» в
  // архиве это не состав, а список отличившихся.
  const players = await tx.player.findMany({ select: { id: true, name: true, role: true } });
  if (players.length === 0) return 0;

  await tx.archivePlayerStat.createMany({
    data: players.map((p) => ({
      archiveId,
      playerId: p.id,
      playerName: p.name,
      role: p.role,
      attendancePct: maps.overall.get(p.id) ?? 0,
      attendancePctPrime: maps.prime.get(p.id) ?? 0,
      attendancePctMiniRb: maps.miniRb.get(p.id) ?? 0,
      pvpCount: maps.pvpCount.get(p.id) ?? 0,
      attended: maps.attended.get(p.id) ?? 0,
      activitiesTotal: maps.totals.overall,
    })),
  });

  return players.length;
}
