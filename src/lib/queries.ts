import { prisma } from "@/lib/prisma";

const dateFmt = new Intl.DateTimeFormat("ru-RU", { day: "numeric", month: "long" });
const shortDateFmt = new Intl.DateTimeFormat("ru-RU", { day: "numeric", month: "short" });

function dayKey(d: Date) {
  return d.toISOString().slice(0, 10);
}

// Посещаемость считается динамически: доля всех активностей за всё время,
// в которых игрок реально участвовал.
async function getAttendanceMap(): Promise<Map<string, number>> {
  const activities = await prisma.activity.findMany({
    select: { participants: { select: { playerId: true } } },
  });

  const totalActivities = activities.length;
  const map = new Map<string, number>();
  if (totalActivities === 0) return map;

  const counts = new Map<string, number>();
  for (const a of activities) {
    for (const p of a.participants) {
      counts.set(p.playerId, (counts.get(p.playerId) ?? 0) + 1);
    }
  }
  for (const [playerId, count] of counts) {
    map.set(playerId, Math.round((count / totalActivities) * 100));
  }
  return map;
}

// Зарплата считается динамически: основная казна (проданный дроп попадает
// туда отдельной операцией) делится между игроками пропорционально их
// посещаемости, скорректированной индивидуальным коэффициентом (0.0–1.25),
// который настраивает админ.
async function getSalaryMap(attendanceMap: Map<string, number>): Promise<Map<string, number>> {
  const [players, treasuryBreakdown] = await Promise.all([
    prisma.player.findMany({ select: { id: true, salaryCoefficient: true } }),
    getTreasuryBreakdown(),
  ]);

  const pool = treasuryBreakdown.main;
  const map = new Map<string, number>();
  if (pool <= 0) {
    for (const p of players) map.set(p.id, 0);
    return map;
  }

  const weights = players.map((p) => ({
    id: p.id,
    weight: (attendanceMap.get(p.id) ?? 0) * p.salaryCoefficient,
  }));
  const totalWeight = weights.reduce((sum, w) => sum + w.weight, 0);
  if (totalWeight <= 0) {
    for (const p of players) map.set(p.id, 0);
    return map;
  }

  for (const w of weights) {
    map.set(w.id, Math.round((w.weight / totalWeight) * pool));
  }
  return map;
}

async function getDerivedPlayerMaps() {
  const attendance = await getAttendanceMap();
  const salary = await getSalaryMap(attendance);
  return { attendance, salary };
}

function withDerived<T extends { id: string }>(
  players: T[],
  derived: { attendance: Map<string, number>; salary: Map<string, number> }
) {
  return players.map((p) => ({
    ...p,
    attendancePct: derived.attendance.get(p.id) ?? 0,
    salary: derived.salary.get(p.id) ?? 0,
  }));
}

export async function getAllPlayers() {
  const [players, derived] = await Promise.all([
    prisma.player.findMany({ orderBy: { createdAt: "asc" } }),
    getDerivedPlayerMaps(),
  ]);
  return withDerived(players, derived);
}

export async function getPlayerById(id: string) {
  const [player, derived] = await Promise.all([
    prisma.player.findUnique({ where: { id } }),
    getDerivedPlayerMaps(),
  ]);
  if (!player) return null;
  return {
    ...player,
    attendancePct: derived.attendance.get(player.id) ?? 0,
    salary: derived.salary.get(player.id) ?? 0,
  };
}

export async function getRegisteredPlayers() {
  const [players, derived] = await Promise.all([
    prisma.player.findMany({
      where: { userId: { not: null } },
      orderBy: { createdAt: "asc" },
    }),
    getDerivedPlayerMaps(),
  ]);
  return withDerived(players, derived);
}

export async function topPlayersByAttendance(count = 5) {
  const [players, derived] = await Promise.all([prisma.player.findMany(), getDerivedPlayerMaps()]);
  return withDerived(players, derived)
    .sort((a, b) => b.attendancePct - a.attendancePct)
    .slice(0, count);
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

export async function getDistinctActivityNames() {
  const rows = await prisma.activity.findMany({
    distinct: ["name"],
    select: { name: true },
    orderBy: { name: "asc" },
  });
  return rows.map((r) => r.name);
}

export type ActivityFilters = {
  dateFrom?: string;
  dateTo?: string;
  status?: string;
  mode?: string;
  category?: string;
  name?: string;
  player?: string;
  page?: number;
  pageSize?: number;
};

export async function getFilteredActivities(filters: ActivityFilters) {
  const { dateFrom, dateTo, status, mode, category, name, player, page = 1, pageSize = 15 } = filters;

  const where: Record<string, unknown> = {};
  const dateFilter: Record<string, Date> = {};
  if (dateFrom) dateFilter.gte = new Date(dateFrom);
  if (dateTo) {
    const end = new Date(dateTo);
    end.setHours(23, 59, 59, 999);
    dateFilter.lte = end;
  }
  if (Object.keys(dateFilter).length > 0) where.date = dateFilter;
  if (status) where.status = status;
  if (mode) where.mode = mode;
  if (category) where.category = category;
  if (name) where.name = name;
  if (player) {
    where.participants = { some: { player: { name: { contains: player } } } };
  }

  const [activities, total] = await Promise.all([
    prisma.activity.findMany({
      where,
      orderBy: { date: "desc" },
      skip: (page - 1) * pageSize,
      take: pageSize,
      include: { _count: { select: { participants: true } } },
    }),
    prisma.activity.count({ where }),
  ]);

  return {
    activities: activities.map((a) => ({
      id: a.id,
      name: a.name,
      category: a.category,
      mode: a.mode,
      difficulty: a.difficulty,
      status: a.status,
      isNight: a.isNight,
      date: dateFmt.format(a.date),
      dateIso: a.date.toISOString().slice(0, 10),
      participants: a._count.participants,
    })),
    total,
    totalPages: Math.max(1, Math.ceil(total / pageSize)),
    page,
  };
}

export async function getActivityById(id: string) {
  const activity = await prisma.activity.findUnique({
    where: { id },
    include: {
      participants: { include: { player: true } },
      drops: { include: { player: true }, orderBy: { createdAt: "desc" } },
      addedBy: { select: { username: true } },
    },
  });
  if (!activity) return null;

  const dropTotal = activity.drops.reduce((sum, d) => sum + d.value, 0);
  const roleCounts: Record<string, number> = {};
  for (const p of activity.participants) {
    roleCounts[p.player.role] = (roleCounts[p.player.role] ?? 0) + 1;
  }

  return {
    id: activity.id,
    name: activity.name,
    category: activity.category,
    mode: activity.mode,
    difficulty: activity.difficulty,
    status: activity.status,
    isNight: activity.isNight,
    perAttendanceValue: activity.perAttendanceValue,
    addedByUsername: activity.addedBy?.username ?? null,
    date: dateFmt.format(activity.date),
    dateIso: activity.date.toISOString().slice(0, 10),
    dropTotal,
    roleCounts,
    roster: activity.participants.map((p) => p.player),
    drops: activity.drops.map((d) => ({
      id: d.id,
      item: d.item,
      quantity: d.quantity,
      value: d.value,
      playerName: d.player?.name ?? null,
    })),
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

// Казна делится на основную (фонд ЗП) и казну гильдии (резерв) в пропорции 70/30.
const TREASURY_MAIN_SHARE = 0.7;

export async function getTreasuryBreakdown() {
  const total = await getTreasuryGold();
  const main = Math.round(total * TREASURY_MAIN_SHARE);
  const guild = total - main;
  return { total, main, guild };
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
  return settings ?? { id: 1, nextPayoutDate: null };
}

export async function getAllDrops(limit?: number) {
  return prisma.dropItem.findMany({
    orderBy: { date: "desc" },
    take: limit,
    include: { activity: true, player: true },
  });
}

// Считаем только непроданный дроп: проданный уже вычтен отсюда и учтён
// в казне отдельной операцией (см. PATCH /api/drops/[id]).
export async function getDropGoldTotal() {
  const result = await prisma.dropItem.aggregate({
    where: { status: "Не продано" },
    _sum: { value: true },
  });
  return result._sum.value ?? 0;
}

// Инвентарь: предметы из журнала дропа, которые ещё не выданы конкретному
// игроку (playerId не указан) и не проданы — то, что сейчас числится за
// гильдией в виде предметов, а не золота.
export async function getInventory() {
  const drops = await prisma.dropItem.findMany({ where: { playerId: null, status: "Не продано" } });
  const map = new Map<string, { item: string; quantity: number; totalValue: number }>();
  for (const d of drops) {
    const existing = map.get(d.item);
    if (existing) {
      existing.quantity += d.quantity;
      existing.totalValue += d.value;
    } else {
      map.set(d.item, { item: d.item, quantity: d.quantity, totalValue: d.value });
    }
  }
  return [...map.values()].sort((a, b) => b.totalValue - a.totalValue);
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
