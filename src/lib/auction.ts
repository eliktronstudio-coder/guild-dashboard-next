import { prisma } from "@/lib/prisma";

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
  | { ok: false; reason: "no-auction" | "finished" | "stale" | "already-leading" };

/** Текущие торги со списком последних ставок. Null — активных торгов нет. */
export async function getActiveAuction() {
  const auction = await prisma.auction.findFirst({
    where: { status: "active" },
    orderBy: { createdAt: "desc" },
    include: { bids: { orderBy: { createdAt: "desc" }, take: BID_HISTORY_LIMIT } },
  });
  if (!auction) return null;

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
 */
export async function startAuction(input: {
  itemName: string;
  itemImageUrl?: string | null;
  catalogItemId?: string | null;
  startingBid: number;
  step: number;
  createdBy?: string | null;
}) {
  const startingBid = Math.max(0, Math.round(input.startingBid));
  const step = Math.max(1, Math.round(input.step));

  return prisma.$transaction(async (tx) => {
    await tx.auction.updateMany({
      where: { status: "active" },
      data: { status: "finished", finishedAt: new Date() },
    });
    return tx.auction.create({
      data: {
        itemName: input.itemName,
        itemImageUrl: input.itemImageUrl ?? null,
        catalogItemId: input.catalogItemId ?? null,
        startingBid,
        step,
        currentBid: startingBid,
        createdBy: input.createdBy ?? null,
      },
    });
  });
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
}): Promise<BidOutcome> {
  const auction = await prisma.auction.findFirst({ where: { status: "active" } });
  if (!auction) return { ok: false, reason: "no-auction" };
  if (auction.status !== "active") return { ok: false, reason: "finished" };
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
export async function skipTurn(input: { playerId: string; name: string }): Promise<BidOutcome> {
  const auction = await prisma.auction.findFirst({ where: { status: "active" } });
  if (!auction) return { ok: false, reason: "no-auction" };

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

/** Завершает торги. Лидер на этот момент и есть победитель. */
export async function finishAuction() {
  const auction = await prisma.auction.findFirst({ where: { status: "active" } });
  if (!auction) return null;

  await prisma.auction.update({
    where: { id: auction.id },
    data: { status: "finished", finishedAt: new Date() },
  });
  return auction;
}
