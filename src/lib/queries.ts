import { prisma } from "@/lib/prisma";

const dateFmt = new Intl.DateTimeFormat("ru-RU", { day: "numeric", month: "long" });
const shortDateFmt = new Intl.DateTimeFormat("ru-RU", { day: "numeric", month: "short" });

function dayKey(d: Date) {
  return d.toISOString().slice(0, 10);
}

// Посещаемость считается динамически: доля активностей, в которых игрок
// реально участвовал. Считается отдельно для всех активностей и отдельно
// по каждой категории (Прайм / Мини-РБ), чтобы можно было смотреть
// посещаемость по типу активности, а не только в среднем.
type ActivityForAttendance = { category: string; participants: { playerId: string }[] };

function buildAttendanceMap(activities: ActivityForAttendance[]): Map<string, number> {
  const total = activities.length;
  const map = new Map<string, number>();
  if (total === 0) return map;

  const counts = new Map<string, number>();
  for (const a of activities) {
    for (const p of a.participants) {
      counts.set(p.playerId, (counts.get(p.playerId) ?? 0) + 1);
    }
  }
  for (const [playerId, count] of counts) {
    map.set(playerId, Math.round((count / total) * 100));
  }
  return map;
}

async function getAttendanceMaps(): Promise<{
  overall: Map<string, number>;
  prime: Map<string, number>;
  miniRb: Map<string, number>;
}> {
  const activities = await prisma.activity.findMany({
    select: { category: true, participants: { select: { playerId: true } } },
  });

  return {
    overall: buildAttendanceMap(activities),
    prime: buildAttendanceMap(activities.filter((a) => a.category === "Прайм")),
    miniRb: buildAttendanceMap(activities.filter((a) => a.category === "Мини-РБ")),
  };
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
  const attendanceMaps = await getAttendanceMaps();
  const salary = await getSalaryMap(attendanceMaps.overall);
  return {
    attendance: attendanceMaps.overall,
    attendancePrime: attendanceMaps.prime,
    attendanceMiniRb: attendanceMaps.miniRb,
    salary,
  };
}

function withDerived<T extends { id: string }>(
  players: T[],
  derived: {
    attendance: Map<string, number>;
    attendancePrime: Map<string, number>;
    attendanceMiniRb: Map<string, number>;
    salary: Map<string, number>;
  }
) {
  return players.map((p) => ({
    ...p,
    attendancePct: derived.attendance.get(p.id) ?? 0,
    attendancePctPrime: derived.attendancePrime.get(p.id) ?? 0,
    attendancePctMiniRb: derived.attendanceMiniRb.get(p.id) ?? 0,
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
    attendancePctPrime: derived.attendancePrime.get(player.id) ?? 0,
    attendancePctMiniRb: derived.attendanceMiniRb.get(player.id) ?? 0,
    salary: derived.salary.get(player.id) ?? 0,
  };
}

export async function getPlayerActivityHistory(playerId: string, limit = 8) {
  const rows = await prisma.activityParticipant.findMany({
    where: { playerId },
    include: { activity: true },
    orderBy: { activity: { date: "desc" } },
    take: limit,
  });
  return rows.map((r) => ({
    id: r.activity.id,
    name: r.activity.name,
    date: dateFmt.format(r.activity.date),
    status: r.activity.status,
  }));
}

export async function getPlayerPayments(playerId: string, limit = 8) {
  const rows = await prisma.payment.findMany({
    where: { playerId },
    orderBy: { date: "desc" },
    take: limit,
  });
  return rows.map((p) => ({
    id: p.id,
    amount: p.amount,
    status: p.status,
    date: dateFmt.format(p.date),
  }));
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

export async function topPlayersByAttendanceCategory(
  field: "attendancePctPrime" | "attendancePctMiniRb",
  count = 5
) {
  const [players, derived] = await Promise.all([prisma.player.findMany(), getDerivedPlayerMaps()]);
  return withDerived(players, derived)
    .sort((a, b) => b[field] - a[field])
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
    status: a.status,
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
      drops: { include: { player: true, catalogItem: true }, orderBy: { createdAt: "desc" } },
      screenshots: { orderBy: { createdAt: "asc" } },
      guests: { orderBy: { createdAt: "asc" } },
      addedBy: { select: { username: true } },
    },
  });
  if (!activity) return null;

  const dropTotal = activity.drops.reduce((sum, d) => sum + d.value * d.quantity, 0);
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
      imageUrl: d.catalogItem?.imageUrl ?? null,
    })),
    rosterScreenshots: activity.screenshots
      .filter((s) => s.kind === "roster")
      .map((s) => ({ id: s.id, imageUrl: s.imageUrl })),
    dropScreenshots: activity.screenshots
      .filter((s) => s.kind === "drop")
      .map((s) => ({ id: s.id, imageUrl: s.imageUrl })),
    guests: activity.guests.map((g) => ({ id: g.id, name: g.name })),
  };
}

export async function getTreasuryTransactions(limit?: number) {
  const transactions = await prisma.treasuryTransaction.findMany({
    orderBy: { date: "desc" },
    take: limit,
  });

  const txIds = transactions.map((t) => t.id);
  const soldDrops = await prisma.dropItem.findMany({
    where: { treasuryTransactionId: { in: txIds } },
    select: { treasuryTransactionId: true, catalogItem: { select: { imageUrl: true } } },
  });
  const iconByTxId = new Map(
    soldDrops.map((d) => [d.treasuryTransactionId as string, d.catalogItem?.imageUrl ?? null])
  );

  return transactions.map((t) => ({ ...t, imageUrl: iconByTxId.get(t.id) ?? null }));
}

export async function getTreasuryGold() {
  const result = await prisma.treasuryTransaction.aggregate({ _sum: { amount: true } });
  return result._sum.amount ?? 0;
}

// Золото, реально попавшее в казну от продажи дропа конкретной категории —
// та же привязка через DropItem.treasuryTransactionId, что и в графике
// "Динамика казны". Не включает выплаты и прочие не-дроп операции.
async function getTreasuryGoldByCategory(category: string): Promise<number> {
  const soldDrops = await prisma.dropItem.findMany({
    where: { status: "Продано", treasuryTransactionId: { not: null }, activity: { category } },
    select: { treasuryTransactionId: true },
  });
  const txIds = soldDrops.map((d) => d.treasuryTransactionId).filter((tid): tid is string => Boolean(tid));
  if (txIds.length === 0) return 0;
  const result = await prisma.treasuryTransaction.aggregate({
    where: { id: { in: txIds } },
    _sum: { amount: true },
  });
  return result._sum.amount ?? 0;
}

// Казна делится на основную (фонд ЗП) и казну гильдии (резерв) в пропорции 70/30.
const TREASURY_MAIN_SHARE = 0.7;

export async function getTreasuryBreakdown() {
  const [total, primeGold, miniRbGold] = await Promise.all([
    getTreasuryGold(),
    getTreasuryGoldByCategory("Прайм"),
    getTreasuryGoldByCategory("Мини-РБ"),
  ]);
  const main = Math.round(total * TREASURY_MAIN_SHARE);
  const guild = total - main;
  const prime = Math.round(primeGold * TREASURY_MAIN_SHARE);
  // Мини-РБ без резерва гильдии — весь доход категории идёт на выплату.
  const miniRb = miniRbGold;
  return { total, main, guild, prime, miniRb };
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

async function getTreasuryDailyDeltas(): Promise<Map<string, number>> {
  const transactions = await prisma.treasuryTransaction.findMany({ select: { date: true, amount: true } });
  const byDay = new Map<string, number>();
  for (const t of transactions) {
    const key = dayKey(t.date);
    byDay.set(key, (byDay.get(key) ?? 0) + t.amount);
  }
  return byDay;
}

// Приток золота от продажи дропа конкретной категории (Мини-РБ / Прайм) —
// сумма treasury-операций, порождённых продажей предмета, чья активность
// принадлежит этой категории. Дата берётся из самой операции (когда
// золото реально попало в казну), а не из даты записи в журнале дропа.
async function getCategoryDailyDeltas(category: string): Promise<Map<string, number>> {
  const soldDrops = await prisma.dropItem.findMany({
    where: { status: "Продано", treasuryTransactionId: { not: null }, activity: { category } },
    select: { treasuryTransactionId: true },
  });
  const txIds = soldDrops.map((d) => d.treasuryTransactionId).filter((tid): tid is string => Boolean(tid));
  const byDay = new Map<string, number>();
  if (txIds.length === 0) return byDay;

  const transactions = await prisma.treasuryTransaction.findMany({
    where: { id: { in: txIds } },
    select: { date: true, amount: true },
  });
  for (const t of transactions) {
    const key = dayKey(t.date);
    byDay.set(key, (byDay.get(key) ?? 0) + t.amount);
  }
  return byDay;
}

// "Динамика казны" для Статистики: общая казна плюс отдельные линии
// притока золота с Мини-РБ и Прайм, все как накопительный итог по дням.
export async function getTreasuryChartCombined() {
  const [total, miniRb, prime] = await Promise.all([
    getTreasuryDailyDeltas(),
    getCategoryDailyDeltas("Мини-РБ"),
    getCategoryDailyDeltas("Прайм"),
  ]);
  const days = [...new Set([...total.keys(), ...miniRb.keys(), ...prime.keys()])].sort();
  let runningTotal = 0;
  let runningMiniRb = 0;
  let runningPrime = 0;
  return days.map((key) => {
    runningTotal += total.get(key) ?? 0;
    runningMiniRb += miniRb.get(key) ?? 0;
    runningPrime += prime.get(key) ?? 0;
    return {
      date: shortDateFmt.format(new Date(key)),
      gold: runningTotal,
      goldMiniRb: runningMiniRb,
      goldPrime: runningPrime,
    };
  });
}

export async function getAllDrops(limit?: number) {
  return prisma.dropItem.findMany({
    orderBy: { date: "desc" },
    take: limit,
    include: { activity: true, player: true, catalogItem: true },
  });
}

export async function getDropCatalog() {
  return prisma.dropCatalogItem.findMany({ orderBy: { name: "asc" } });
}

// Считаем только непроданный дроп: проданный уже вычтен отсюда и учтён
// в казне отдельной операцией (см. PATCH /api/drops/[id]). value — цена за
// единицу, поэтому вклад записи в сумму — value * quantity.
export async function getDropGoldTotal() {
  const drops = await prisma.dropItem.findMany({
    where: { status: "Не продано" },
    select: { value: true, quantity: true },
  });
  return drops.reduce((sum, d) => sum + d.value * d.quantity, 0);
}

// То же самое, но только дроп с активностей указанной категории
// (Мини-РБ / Прайм) — для раздельной статистики на Казне.
export async function getDropGoldTotalByCategory(category: string) {
  const drops = await prisma.dropItem.findMany({
    where: { status: "Не продано", activity: { category } },
    select: { value: true, quantity: true },
  });
  return drops.reduce((sum, d) => sum + d.value * d.quantity, 0);
}

// Инвентарь: предметы из журнала дропа, которые ещё не выданы конкретному
// игроку (playerId не указан) и не проданы — то, что сейчас числится за
// гильдией в виде предметов, а не золота.
// Инвентарь = весь непроданный дроп из журнала (проданное уже стало
// золотом в казне и не считается физическим запасом), сгруппированный
// по названию предмета для отображения иконками с суммарным количеством.
export async function getInventory() {
  const drops = await prisma.dropItem.findMany({
    where: { status: "Не продано" },
    include: { catalogItem: { select: { imageUrl: true } }, player: { select: { name: true } } },
    orderBy: { date: "desc" },
  });

  type Entry = { id: string; quantity: number; value: number; date: string; playerName: string | null };
  const map = new Map<string, { item: string; quantity: number; totalValue: number; imageUrl: string | null; entries: Entry[] }>();
  for (const d of drops) {
    const lineValue = d.value * d.quantity;
    const existing = map.get(d.item);
    const entry: Entry = {
      id: d.id,
      quantity: d.quantity,
      value: d.value,
      date: dateFmt.format(d.date),
      playerName: d.player?.name ?? null,
    };
    if (existing) {
      existing.quantity += d.quantity;
      existing.totalValue += lineValue;
      existing.entries.push(entry);
      if (!existing.imageUrl && d.catalogItem?.imageUrl) existing.imageUrl = d.catalogItem.imageUrl;
    } else {
      map.set(d.item, {
        item: d.item,
        quantity: d.quantity,
        totalValue: lineValue,
        imageUrl: d.catalogItem?.imageUrl ?? null,
        entries: [entry],
      });
    }
  }
  return [...map.values()].sort((a, b) => b.totalValue - a.totalValue);
}

export async function getAvgAttendanceLast30Days() {
  const since = new Date();
  since.setDate(since.getDate() - 30);
  const activities = await prisma.activity.findMany({
    where: { date: { gte: since } },
    include: { _count: { select: { participants: true } } },
  });
  if (activities.length === 0) return 0;
  const total = activities.reduce((sum, a) => sum + a._count.participants, 0);
  return Math.round(total / activities.length);
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
