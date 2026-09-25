import { prisma } from "@/lib/prisma";
import { getActivePeriodId } from "@/lib/period";
import { clampDuration } from "@/lib/auctionTime";

// Ре-экспорт, чтобы у вызывающих был один вход в механику торгов.
export { MIN_DURATION_SEC, MAX_DURATION_SEC, formatRemaining } from "@/lib/auctionTime";

/**
 * Живые торги. Состояние держится в базе, а не в браузере ведущего, поэтому
 * участники ставят со своих устройств и видят одно и то же.
 *
 * Вся механика собрана здесь, а не в маршрутах, чтобы тесты проверяли ровно
 * тот код, который работает в бою.
 */

export const BID_HISTORY_LIMIT = 7;

export type BidOutcome =
  | { ok: true; amount: number }
  | { ok: false; reason: "no-auction" | "finished" | "stale" | "already-leading" | "expired" };


/** Текущие торги со списком последних ставок. Null — активных торгов нет. */
export async function getActiveAuction(now = new Date()) {
  const auction = await prisma.auction.findFirst({
    where: { status: "active" },
    orderBy: { createdAt: "desc" },
    include: { bids: { orderBy: { createdAt: "desc" }, take: BID_HISTORY_LIMIT } },
  });
  if (!auction) return null;

  // Остаток считаем на сервере и отдаём числом: у участников часы выставлены
  // по-разному, и если бы каждый вычитал endsAt из своего времени, таймеры
  // разъехались бы. Клиент просто тикает от полученного значения.
  const remainingMs = auction.endsAt ? Math.max(0, auction.endsAt.getTime() - now.getTime()) : null;

  return {
    id: auction.id,
    itemName: auction.itemName,
    itemImageUrl: auction.itemImageUrl,
    startingBid: auction.startingBid,
    step: auction.step,
    currentBid: auction.currentBid,
    leaderPlayerId: auction.leaderPlayerId,
    leaderName: auction.leaderName,
    createdAt: auction.createdAt,
    hasTimer: auction.endsAt !== null,
    remainingMs,
    expired: remainingMs !== null && remainingMs <= 0,
    history: auction.bids.map((b) => ({
      id: b.id,
      name: b.name,
      amount: b.amount,
      kind: b.kind,
      at: b.createdAt,
    })),
  };
}

export type ActiveAuction = NonNullable<Awaited<ReturnType<typeof getActiveAuction>>>;

/**
 * Открывает торги. Прежние активные закрываются: одновременно идущих
 * аукционов не бывает — иначе участники ставили бы в разные лоты, не понимая,
 * какой из них сейчас на экране у ведущего.
 *
 * durationSec = null — торги без таймера, до ручного завершения.
 */
export async function startAuction(input: {
  itemName: string;
  itemImageUrl?: string | null;
  catalogItemId?: string | null;
  startingBid: number;
  step: number;
  durationSec?: number | null;
  createdBy?: string | null;
  now?: Date;
}) {
  const now = input.now ?? new Date();
  const startingBid = Math.max(0, Math.round(input.startingBid));
  const step = Math.max(1, Math.round(input.step));
  const endsAt =
    input.durationSec === null || input.durationSec === undefined
      ? null
      : new Date(now.getTime() + clampDuration(input.durationSec) * 1000);

  // Прежние торги закрываем штатно, а не просто помечаем завершёнными: у них
  // мог быть лидер, и его ставка обязана уйти в казну так же, как при обычном
  // завершении. Иначе новые торги поверх старых молча съедали бы золото.
  await finishAuction(now);

  return prisma.auction.create({
    data: {
      itemName: input.itemName,
      itemImageUrl: input.itemImageUrl ?? null,
      catalogItemId: input.catalogItemId ?? null,
      startingBid,
      step,
      currentBid: startingBid,
      endsAt,
      createdBy: input.createdBy ?? null,
    },
  });
}

/**
 * Правит таймер уже идущих торгов.
 *
 * `deltaSec` — добавить или снять время (отсчёт от текущего конца).
 * `durationSec` — задать остаток заново, считая от сейчас.
 * `durationSec: null` — снять ограничение времени совсем.
 *
 * Время, ушедшее в минус, подтягивается к «сейчас»: торги с отрицательным
 * остатком показывали бы растущий счётчик наоборот.
 */
export async function adjustTimer(
  input: { deltaSec?: number; durationSec?: number | null },
  now = new Date()
) {
  const auction = await prisma.auction.findFirst({ where: { status: "active" } });
  if (!auction) return null;

  let endsAt: Date | null;
  if (input.durationSec !== undefined) {
    endsAt = input.durationSec === null ? null : new Date(now.getTime() + clampDuration(input.durationSec) * 1000);
  } else if (input.deltaSec !== undefined) {
    // Если таймера не было, отсчитываем прибавку от сейчас — иначе прибавлять
    // не к чему и «+30 секунд» молча ничего бы не сделали.
    const base = auction.endsAt ?? now;
    const shifted = base.getTime() + Math.round(input.deltaSec) * 1000;
    endsAt = new Date(Math.max(now.getTime(), shifted));
  } else {
    return auction;
  }

  return prisma.auction.update({ where: { id: auction.id }, data: { endsAt } });
}

/**
 * Поднимает цену на шаг и делает игрока лидером.
 *
 * `expectedBid` — цена, которую участник видел в момент нажатия. Если к этому
 * моменту кто-то успел поставить, обновление не пройдёт и ставка отклонится:
 * без этой проверки двое, нажавших одновременно, получили бы одну и ту же
 * сумму, и второй молча перебил бы первого, не заплатив шаг.
 */
export async function placeBid(input: {
  playerId: string;
  name: string;
  expectedBid: number;
  now?: Date;
}): Promise<BidOutcome> {
  const now = input.now ?? new Date();
  const auction = await prisma.auction.findFirst({ where: { status: "active" } });
  if (!auction) return { ok: false, reason: "no-auction" };
  if (auction.endsAt && auction.endsAt.getTime() <= now.getTime()) return { ok: false, reason: "expired" };
  if (auction.leaderPlayerId === input.playerId) return { ok: false, reason: "already-leading" };
  if (auction.currentBid !== input.expectedBid) return { ok: false, reason: "stale" };

  const amount = auction.currentBid + auction.step;

  // updateMany с условием по текущей цене — это и есть защита от гонки:
  // запись обновит только тот запрос, который пришёл первым.
  const { count } = await prisma.auction.updateMany({
    where: { id: auction.id, status: "active", currentBid: input.expectedBid },
    data: { currentBid: amount, leaderPlayerId: input.playerId, leaderName: input.name },
  });
  if (count === 0) return { ok: false, reason: "stale" };

  await prisma.auctionBid.create({
    data: { auctionId: auction.id, playerId: input.playerId, name: input.name, amount, kind: "bid" },
  });

  return { ok: true, amount };
}

/** Пропуск хода: цену не меняет, только попадает в журнал. */
export async function skipTurn(input: {
  playerId: string;
  name: string;
  now?: Date;
}): Promise<BidOutcome> {
  const now = input.now ?? new Date();
  const auction = await prisma.auction.findFirst({ where: { status: "active" } });
  if (!auction) return { ok: false, reason: "no-auction" };
  if (auction.endsAt && auction.endsAt.getTime() <= now.getTime()) return { ok: false, reason: "expired" };

  await prisma.auctionBid.create({
    data: {
      auctionId: auction.id,
      playerId: input.playerId,
      name: input.name,
      amount: auction.currentBid,
      kind: "skip",
    },
  });
  return { ok: true, amount: auction.currentBid };
}

/**
 * Завершает торги. Лидер на этот момент и есть победитель, а его ставка
 * заводится в казну продажей категории «Прайм» — оттуда 70% уходят в фонд
 * зарплаты и делятся между игроками по посещаемости, 30% остаются резервом
 * гильдии (см. getTreasuryBreakdown).
 *
 * Обе записи делаются одной транзакцией: торги, помеченные завершёнными без
 * операции в казне, означали бы, что предмет ушёл, а золото не пришло, и
 * заметить это было бы нечем — повторное завершение уже ничего не создаст.
 *
 * Если ставок не было, лидера нет и продавать нечего — операция не создаётся.
 */
export async function finishAuction(now = new Date()) {
  const auction = await prisma.auction.findFirst({ where: { status: "active" } });
  if (!auction) return null;

  const hasWinner = auction.leaderPlayerId !== null && auction.currentBid > 0;
  // Период берём до транзакции: getActivePeriodId сам может создать или
  // починить период, и внутри чужой транзакции это лишняя запись.
  const periodId = hasWinner ? await getActivePeriodId() : null;

  await prisma.$transaction(async (tx) => {
    await tx.auction.update({
      where: { id: auction.id },
      data: { status: "finished", finishedAt: now },
    });
    if (hasWinner) {
      await tx.treasuryTransaction.create({
        data: {
          description: `Аукцион: ${auction.itemName} — ${auction.leaderName}`,
          amount: auction.currentBid,
          category: "Прайм",
          periodId,
          date: now,
        },
      });
    }
  });

  return { ...auction, soldFor: hasWinner ? auction.currentBid : 0 };
}

/** Сколько плиток победителей показываем на странице. */
export const WINNERS_LIMIT = 12;

/**
 * Завершённые торги, у которых есть победитель, — лента «кто что забрал».
 *
 * Берём только со ставками: торги, закрытые без единой ставки, лотом ни к
 * кому не ушли и в списке победителей им делать нечего.
 */
export async function getAuctionWinners(limit = WINNERS_LIMIT) {
  const rows = await prisma.auction.findMany({
    where: { status: "finished", leaderPlayerId: { not: null } },
    orderBy: { finishedAt: "desc" },
    take: limit,
    select: {
      id: true,
      itemName: true,
      itemImageUrl: true,
      currentBid: true,
      leaderName: true,
      finishedAt: true,
      createdAt: true,
    },
  });

  return rows.map((r) => ({
    id: r.id,
    itemName: r.itemName,
    itemImageUrl: r.itemImageUrl,
    amount: r.currentBid,
    winner: r.leaderName ?? "—",
    // finishedAt проставляется при завершении; у старых записей его могло не
    // быть, поэтому подстраховываемся датой создания.
    at: r.finishedAt ?? r.createdAt,
  }));
}
