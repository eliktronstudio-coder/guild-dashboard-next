import { prisma } from "@/lib/prisma";

const dateFmt = new Intl.DateTimeFormat("ru-RU", { day: "numeric", month: "long" });
const shortDateFmt = new Intl.DateTimeFormat("ru-RU", { day: "numeric", month: "short" });

function dayKey(d: Date) {
  return d.toISOString().slice(0, 10);
}

export async function getAllPlayers() {
  return prisma.player.findMany({ orderBy: { createdAt: "asc" } });
}

export async function getPlayerById(id: string) {
  return prisma.player.findUnique({ where: { id } });
}

export async function topPlayersByAttendance(count = 5) {
  return prisma.player.findMany({ orderBy: { attendancePct: "desc" }, take: count });
}

export async function topPlayersByXp(count = 5) {
  return prisma.player.findMany({ orderBy: { xp: "desc" }, take: count });
}

export async function getAllActivities() {
  const activities = await prisma.activity.findMany({
    orderBy: { date: "desc" },
    include: { _count: { select: { participants: true } } },
  });
  return activities.map((a) => ({
    id: a.id,
    name: a.name,
    date: dateFmt.format(a.date),
    participants: a._count.participants,
  }));
}

export async function getActivityById(id: string) {
  const activity = await prisma.activity.findUnique({
    where: { id },
    include: { participants: { include: { player: true } } },
  });
  if (!activity) return null;
  return {
    id: activity.id,
    name: activity.name,
    date: dateFmt.format(activity.date),
    roster: activity.participants.map((p) => p.player),
  };
}

export async function getTreasuryTransactions(limit?: number) {
  return prisma.treasuryTransaction.findMany({
    orderBy: { date: "desc" },
    take: limit,
  });
}

export async function getTreasuryGold() {
  const result = await prisma.treasuryTransaction.aggregate({ _sum: { amount: true } });
  return result._sum.amount ?? 0;
}

export async function getTreasuryChartData() {
  const transactions = await prisma.treasuryTransaction.findMany({ orderBy: { date: "asc" } });
  const byDay = new Map<string, number>();
  for (const t of transactions) {
    const key = dayKey(t.date);
    byDay.set(key, (byDay.get(key) ?? 0) + t.amount);
  }
  const days = [...byDay.keys()].sort();
  let running = 0;
  return days.map((key) => {
    running += byDay.get(key)!;
    return { date: shortDateFmt.format(new Date(key)), gold: running };
  });
}

export async function getGuildSettings() {
  const settings = await prisma.guildSettings.findUnique({ where: { id: 1 } });
  return settings ?? { id: 1, raidDropGoldEquivalent: 0, nextPayoutDate: null };
}

export async function getAvgActivityDays() {
  const activities = await prisma.activity.findMany({ orderBy: { date: "asc" }, select: { date: true } });
  if (activities.length < 2) return 0;
  const first = activities[0].date.getTime();
  const last = activities[activities.length - 1].date.getTime();
  const days = (last - first) / (1000 * 60 * 60 * 24);
  return Math.round(days / (activities.length - 1));
}

export async function getAttendanceChartData() {
  const activities = await prisma.activity.findMany({
    orderBy: { date: "asc" },
    include: { _count: { select: { participants: true } } },
  });
  const byDay = new Map<string, number>();
  for (const a of activities) {
    const key = dayKey(a.date);
    byDay.set(key, (byDay.get(key) ?? 0) + a._count.participants);
  }
  const days = [...byDay.keys()].sort().slice(-7);
  return days.map((key) => ({ date: shortDateFmt.format(new Date(key)), count: byDay.get(key)! }));
}

export async function getAllPayments() {
  return prisma.payment.findMany({ orderBy: { date: "desc" }, include: { player: true } });
}

export async function getAllAuctionLots() {
  return prisma.auctionLot.findMany({ orderBy: { endsAt: "asc" }, include: { seller: true } });
}

export async function getAllTournaments() {
  return prisma.tournament.findMany({ orderBy: { startDate: "desc" } });
}
