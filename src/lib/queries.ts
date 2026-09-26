import { prisma } from "@/lib/prisma";
import { getActivePeriodId } from "@/lib/period";
import { computeAttendanceMaps } from "@/lib/attendance";
import { computeSalaryMap } from "@/lib/salary";

const dateFmt = new Intl.DateTimeFormat("ru-RU", { day: "numeric", month: "long" });
const shortDateFmt = new Intl.DateTimeFormat("ru-RU", { day: "numeric", month: "short" });

function dayKey(d: Date) {
  return d.toISOString().slice(0, 10);
}

/** Начало недели (понедельник, UTC), в виде YYYY-MM-DD. */
function weekKey(d: Date) {
  const date = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
  const isoDay = date.getUTCDay() || 7; // Вс=0 -> 7, чтобы неделя начиналась с Пн.
  if (isoDay !== 1) date.setUTCDate(date.getUTCDate() - (isoDay - 1));
  return date.toISOString().slice(0, 10);
}

/**
 * Посещаемость считается только по активностям ТЕКУЩЕГО расчётного периода
 * (15→15) — каждый новый период статистика начинается заново, чтобы старая
 * активность не тянула процент вниз/вверх бесконечно. periodId берём заранее
 * (getActivePeriodId), а не резолвим здесь — иначе каждый вызов рисковал бы
 * молча создать новый период, если активного ещё нет.
 */
async function getAttendanceMaps(periodId: string) {
  const activities = await prisma.activity.findMany({
    where: { periodId, archiveId: null },
    select: { name: true, category: true, mode: true, weight: true, participants: { select: { playerId: true } } },
  });
  return computeAttendanceMaps(activities);
}

// Зарплата считается динамически и отдельно по каждой казне — Прайм (70% с
// продаж категории Прайм) и Мини-РБ (100% с продаж категории Мини-РБ) — и
// делится между игроками пропорционально ИХ посещаемости той же категории.
// Сам расчёт — в src/lib/salary.ts, общий со снимком при архивации.
async function getSalaryMapForPool(attendanceMap: Map<string, number>, pool: number): Promise<Map<string, number>> {
  const players = await prisma.player.findMany({ select: { id: true, salaryCoefficient: true } });
  return computeSalaryMap(players, attendanceMap, pool);
}

/**
 * Фонд, который делится между игроками, — исходная сумма периода, а не
 * остаток казны. Остаток уменьшается с каждой выплатой, поэтому доли,
 * посчитанные от него, «плыли»: заплатили одному — у всех остальных
 * показанная сумма падала, хотя они ничего не получили. Раньше это лечили
 * ручной кнопкой «Зарплата» (снимок PayoutSnapshot); теперь лечить нечего.
 */
export function distributionPools(breakdown: {
  prime: number;
  miniRb: number;
  payout: { prime: number; miniRb: number };
}) {
  return {
    prime: breakdown.prime + breakdown.payout.prime,
    miniRb: breakdown.miniRb + breakdown.payout.miniRb,
  };
}

async function getDerivedPlayerMaps() {
  const periodId = await getActivePeriodId();
  const [attendanceMaps, treasuryBreakdown] = await Promise.all([getAttendanceMaps(periodId), getTreasuryBreakdown()]);
  const pools = distributionPools(treasuryBreakdown);
  const [salaryPrime, salaryMiniRb] = await Promise.all([
    getSalaryMapForPool(attendanceMaps.prime, pools.prime),
    getSalaryMapForPool(attendanceMaps.miniRb, pools.miniRb),
  ]);
  return {
    attendance: attendanceMaps.overall,
    attendancePrime: attendanceMaps.prime,
    attendanceMiniRb: attendanceMaps.miniRb,
    pvpCount: attendanceMaps.pvpCount,
    salaryPrime,
    salaryMiniRb,
  };
}

function withDerived<T extends { id: string }>(
  players: T[],
  derived: {
    attendance: Map<string, number>;
    attendancePrime: Map<string, number>;
    attendanceMiniRb: Map<string, number>;
    pvpCount: Map<string, number>;
    salaryPrime: Map<string, number>;
    salaryMiniRb: Map<string, number>;
  }
) {
  return players.map((p) => {
    const salaryPrime = derived.salaryPrime.get(p.id) ?? 0;
    const salaryMiniRb = derived.salaryMiniRb.get(p.id) ?? 0;
    return {
      ...p,
      attendancePct: derived.attendance.get(p.id) ?? 0,
      attendancePctPrime: derived.attendancePrime.get(p.id) ?? 0,
      attendancePctMiniRb: derived.attendanceMiniRb.get(p.id) ?? 0,
      pvpCount: derived.pvpCount.get(p.id) ?? 0,
      salaryPrime,
      salaryMiniRb,
      salary: salaryPrime + salaryMiniRb,
    };
  });
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
  return withDerived([player], derived)[0];
}

/** Для «Моего профиля» — карточка игрока, привязанная к своему аккаунту. */
export async function getPlayerByUserId(userId: string) {
  const [player, derived] = await Promise.all([
    prisma.player.findUnique({ where: { userId } }),
    getDerivedPlayerMaps(),
  ]);
  if (!player) return null;
  return withDerived([player], derived)[0];
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

/**
 * Участия игрока по неделям за последние `weeks` недель, включая недели без
 * посещений (0), чтобы график шёл сплошной шкалой, а не перескакивал через
 * пропуски.
 */
export async function getPlayerAttendanceChartData(playerId: string, weeks = 10) {
  const rows = await prisma.activityParticipant.findMany({
    where: { playerId },
    select: { activity: { select: { date: true } } },
  });
  const byWeek = new Map<string, number>();
  for (const r of rows) {
    const key = weekKey(r.activity.date);
    byWeek.set(key, (byWeek.get(key) ?? 0) + 1);
  }
  const currentWeekStart = new Date(weekKey(new Date()));
  const result: { date: string; count: number }[] = [];
  for (let i = weeks - 1; i >= 0; i--) {
    const d = new Date(currentWeekStart);
    d.setUTCDate(d.getUTCDate() - i * 7);
    result.push({ date: shortDateFmt.format(d), count: byWeek.get(dayKey(d)) ?? 0 });
  }
  return result;
}

/**
 * Посещаемость по дням за последние `days` дней, отдельно по Прайм, Мини-РБ
 * и PvP (категория и режим — независимые признаки активности, поэтому это
 * три отдельных счётчика, а не взаимоисключающие доли одного). В дни без
 * участия — 0, график идёт сплошной линией до конца периода, не обрываясь.
 * total — сколько всего активностей (Прайм + Мини-РБ) провела гильдия в
 * этот день, для сравнения личного участия с общим количеством.
 */
export async function getPlayerDailyAttendance(playerId: string, days = 30) {
  const [rows, guildActivities] = await Promise.all([
    prisma.activityParticipant.findMany({
      where: { playerId },
      select: { activity: { select: { date: true, category: true, mode: true } } },
    }),
    prisma.activity.findMany({
      where: { category: { in: ["Прайм", "Мини-РБ"] } },
      select: { date: true },
    }),
  ]);
  const byDayPrime = new Map<string, number>();
  const byDayMiniRb = new Map<string, number>();
  const byDayPvp = new Map<string, number>();
  for (const r of rows) {
    const key = dayKey(r.activity.date);
    if (r.activity.category === "Прайм") byDayPrime.set(key, (byDayPrime.get(key) ?? 0) + 1);
    if (r.activity.category === "Мини-РБ") byDayMiniRb.set(key, (byDayMiniRb.get(key) ?? 0) + 1);
    if (r.activity.mode === "PvP") byDayPvp.set(key, (byDayPvp.get(key) ?? 0) + 1);
  }
  const byDayTotal = new Map<string, number>();
  for (const a of guildActivities) {
    const key = dayKey(a.date);
    byDayTotal.set(key, (byDayTotal.get(key) ?? 0) + 1);
  }
  const now = new Date();
  const todayUTC = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  const result: { date: string; prime: number; miniRb: number; pvp: number; total: number }[] = [];
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(todayUTC);
    d.setUTCDate(d.getUTCDate() - i);
    const key = d.toISOString().slice(0, 10);
    result.push({
      date: shortDateFmt.format(d),
      prime: byDayPrime.get(key) ?? 0,
      miniRb: byDayMiniRb.get(key) ?? 0,
      pvp: byDayPvp.get(key) ?? 0,
      total: byDayTotal.get(key) ?? 0,
    });
  }
  return result;
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
    where: { archiveId: null },
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
    where: { archiveId: null },
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

  const where: Record<string, unknown> = { archiveId: null };
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
      weight: a.weight,
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
      organizer: { select: { id: true, name: true } },
      raidLeader: { select: { id: true, name: true } },
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
    weight: activity.weight,
    addedByUsername: activity.addedBy?.username ?? null,
    date: dateFmt.format(activity.date),
    dateIso: activity.date.toISOString().slice(0, 10),
    dropTotal,
    roleCounts,
    roster: activity.participants.map((p) => ({ ...p.player, fullParticipation: p.fullParticipation })),
    // Достижения: факты, подтверждаемые вручную, — участие сам по себе ни
    // убийством, ни победой, ни полным присутствием не является.
    bossKey: activity.bossKey,
    bossKillConfirmed: activity.bossKillConfirmed,
    killCount: activity.killCount,
    pvpResult: activity.pvpResult,
    pvpGuildRaid: activity.pvpGuildRaid,
    guildDefense: activity.guildDefense,
    organizerPlayerId: activity.organizerPlayerId,
    organizerName: activity.organizer?.name ?? null,
    raidLeaderPlayerId: activity.raidLeaderPlayerId,
    raidLeaderName: activity.raidLeader?.name ?? null,
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
    where: { archiveId: null },
    orderBy: { date: "desc" },
    take: limit,
  });

  const txIds = transactions.map((t) => t.id);
  const soldDrops = await prisma.dropItem.findMany({
    where: { treasuryTransactionId: { in: txIds } },
    select: { treasuryTransactionId: true, quantity: true, catalogItem: { select: { imageUrl: true } } },
  });
  const iconByTxId = new Map<string, string | null>();
  const quantityByTxId = new Map<string, number>();
  for (const d of soldDrops) {
    const txId = d.treasuryTransactionId as string;
    if (!iconByTxId.has(txId)) iconByTxId.set(txId, d.catalogItem?.imageUrl ?? null);
    quantityByTxId.set(txId, (quantityByTxId.get(txId) ?? 0) + d.quantity);
  }

  return transactions.map((t) => ({
    ...t,
    imageUrl: iconByTxId.get(t.id) ?? null,
    quantity: quantityByTxId.get(t.id) ?? 0,
  }));
}

/**
 * Область расчёта казны: живой баланс (archiveId: null) или книги одного
 * архива. Все функции ниже принимают её, чтобы архив считался ТЕМ ЖЕ кодом,
 * что и живая казна. Раньше архив суммировал операции по полю category
 * напрямую — без разбора категорий по проданным позициям, без резерва
 * гильдии и без учёта выплат, — и показывал неверные Мини-РБ и итог.
 */
export type TreasuryScope = { archiveId: string | null };

const LIVE: TreasuryScope = { archiveId: null };

export async function getTreasuryGold(scope: TreasuryScope = LIVE) {
  const result = await prisma.treasuryTransaction.aggregate({
    where: { archiveId: scope.archiveId },
    _sum: { amount: true },
  });
  return result._sum.amount ?? 0;
}

// Золото, реально попавшее в казну от продажи дропа, разложенное по
// категории (Прайм / Мини-РБ) — БЕЗ дублирования. Одна операция в казне
// может включать предметы разных категорий (объединённая продажа по
// названию предмета, см. /api/drops/sell): если считать "эта операция
// затронула категорию X → вся сумма операции идёт в X" для каждой
// категории по отдельности, при смешанных продажах сумма операции
// засчитывается в обе категории сразу — отсюда "Казна с Прайма" и
// "Казна мини-РБ" вместе превышали реальную казну, а "Казна гильдии"
// (остаток) уходила в минус. Вместо этого делим сумму каждой операции
// пропорционально номинальной стоимости (value*quantity) проданных в
// ней позиций по категориям — так сумма операции учитывается ровно
// один раз. Позиции без категории (ручное добавление в Общий без
// активности) считаются как Прайм — тот же порядок, что и в "Дроп с
// Мини-РБ / Дроп с Прайм".
async function getTreasurySplitByCategory(scope: TreasuryScope = LIVE): Promise<{ prime: number; miniRb: number }> {
  // Операции только из своей области: для живого баланса — незаархивированные,
  // для архива — его собственные (см. Archive в schema.prisma).
  const liveTxIds = new Set(
    (await prisma.treasuryTransaction.findMany({ where: { archiveId: scope.archiveId }, select: { id: true } })).map((t) => t.id)
  );

  const soldAll = await prisma.dropItem.findMany({
    where: { status: "Продано", treasuryTransactionId: { not: null } },
    select: { treasuryTransactionId: true, category: true, value: true, quantity: true },
  });
  const sold = soldAll.filter((d) => liveTxIds.has(d.treasuryTransactionId as string));

  // Операции с собственной категорией и без привязанного дропа («Продажа
  // Мини-РБ»): вся сумма идёт в свою категорию. Без этого такая продажа
  // не попадала бы ни в Прайм, ни в Мини-РБ и оседала в остатке, то есть
  // в «Казне гильдии». Выплаты ЗП (kind="payout") сюда не входят — они
  // расход, а не доход, и считаются отдельно в getTreasuryPayoutSplit,
  // минуя 70%-й множитель (см. комментарий у поля kind в schema.prisma).
  const tagged = await prisma.treasuryTransaction.findMany({
    where: { category: { not: null }, kind: null, archiveId: scope.archiveId },
    select: { id: true, amount: true, category: true },
  });
  const soldTxIds = new Set(sold.map((d) => d.treasuryTransactionId as string));
  let taggedPrime = 0;
  let taggedMiniRb = 0;
  for (const tx of tagged) {
    // Если к операции всё же привязан дроп, категория позиций точнее —
    // её и используем, чтобы не посчитать сумму дважды.
    if (soldTxIds.has(tx.id)) continue;
    if (tx.category === "Мини-РБ") taggedMiniRb += tx.amount;
    else taggedPrime += tx.amount;
  }

  if (sold.length === 0) return { prime: Math.round(taggedPrime), miniRb: Math.round(taggedMiniRb) };

  const txIds = [...new Set(sold.map((d) => d.treasuryTransactionId as string))];
  const transactions = await prisma.treasuryTransaction.findMany({
    where: { id: { in: txIds } },
    select: { id: true, amount: true },
  });
  const amountByTx = new Map(transactions.map((t) => [t.id, t.amount]));

  const byTx = new Map<string, { prime: number; miniRb: number; nominalTotal: number }>();
  for (const d of sold) {
    const txId = d.treasuryTransactionId as string;
    const line = d.value * d.quantity;
    const bucket = byTx.get(txId) ?? { prime: 0, miniRb: 0, nominalTotal: 0 };
    bucket.nominalTotal += line;
    if (d.category === "Мини-РБ") bucket.miniRb += line;
    else bucket.prime += line;
    byTx.set(txId, bucket);
  }

  let prime = taggedPrime;
  let miniRb = taggedMiniRb;
  for (const [txId, bucket] of byTx) {
    const amount = amountByTx.get(txId) ?? 0;
    if (bucket.nominalTotal <= 0) {
      prime += amount;
      continue;
    }
    prime += amount * (bucket.prime / bucket.nominalTotal);
    miniRb += amount * (bucket.miniRb / bucket.nominalTotal);
  }
  return { prime: Math.round(prime), miniRb: Math.round(miniRb) };
}

// Казна делится на основную (фонд ЗП) и казну гильдии (резерв) в пропорции 70/30.
const TREASURY_MAIN_SHARE = 0.7;

// Сколько уже выплачено по каждой категории (kind="payout", см. schema.prisma).
// Считается отдельно от дохода и вычитается из prime/miniRb 1:1, ПОСЛЕ
// 70%-го множителя — см. комментарий у поля kind.
async function getTreasuryPayoutSplit(scope: TreasuryScope = LIVE): Promise<{ prime: number; miniRb: number }> {
  const rows = await prisma.treasuryTransaction.groupBy({
    by: ["category"],
    where: { kind: "payout", archiveId: scope.archiveId },
    _sum: { amount: true },
  });
  let prime = 0;
  let miniRb = 0;
  for (const r of rows) {
    // amount у выплат отрицательный (расход); переводим в положительную
    // сумму "сколько выплачено".
    const paid = -(r._sum.amount ?? 0);
    if (r.category === "Мини-РБ") miniRb += paid;
    else if (r.category === "Прайм") prime += paid;
  }
  return { prime, miniRb };
}

export async function getTreasuryBreakdown(scope: TreasuryScope = LIVE) {
  const [total, { prime: primeGold, miniRb: miniRbGold }, payout] = await Promise.all([
    getTreasuryGold(scope),
    getTreasurySplitByCategory(scope),
    getTreasuryPayoutSplit(scope),
  ]);
  const main = Math.round(total * TREASURY_MAIN_SHARE);
  // Мини-РБ без резерва гильдии — весь доход категории идёт на выплату,
  // поэтому 30%-й резерв гильдии считаем только с дохода Прайма (и прочих
  // операций вне категорий), а не со всей казны — иначе продажа дропа с
  // Мини-РБ ошибочно "прибавляла" гильдии 30% с чужих денег.
  //
  // Выплаченное вычитается уже из финальной суммы (после множителя для
  // Прайма), а не из "сырого" дохода: total уменьшается на ту же сумму
  // при создании операции выплаты (см. /api/payments/payout), поэтому
  // казна гильдии (total - prime - miniRb) от выплаты не меняется.
  const prime = Math.round(primeGold * TREASURY_MAIN_SHARE) - payout.prime;
  const miniRb = miniRbGold - payout.miniRb;
  const guild = total - prime - miniRb;
  // payout отдаём наружу, чтобы можно было получить ИСХОДНЫЙ фонд периода
  // (prime + payout.prime). Остаток prime уменьшается с каждой выплатой, и
  // считать от него доли нельзя: доля ещё не получившего игрока падала бы
  // после каждой чужой выплаты — см. distributionPools ниже.
  return { total, main, guild, prime, miniRb, payout };
}

export async function getTreasuryChartData() {
  const transactions = await prisma.treasuryTransaction.findMany({ where: { archiveId: null }, orderBy: { date: "asc" } });
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
  const transactions = await prisma.treasuryTransaction.findMany({
    where: { archiveId: null },
    select: { date: true, amount: true },
  });
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
    where: { id: { in: txIds }, archiveId: null },
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

function sumGold(drops: { value: number; quantity: number }[]) {
  return drops.reduce((sum, d) => sum + d.value * d.quantity, 0);
}

// "Дроп общего инвентаря" — весь непроданный остаток в Общем инвентаре,
// независимо от того, попал он туда с активности или добавлен вручную.
// Должно совпадать с суммой, которую показывает сама панель "Общий
// Инвентарь" ("N золота нераспределено") — на практике почти весь
// дроп туда добавляют вручную, без привязки к активности, так что
// фильтр по category раньше оставлял эту ячейку почти всегда пустой.
export async function getDropGoldGeneralAuto() {
  const drops = await prisma.dropItem.findMany({
    where: { status: "Не продано", warehouse: "Общий" },
    select: { value: true, quantity: true },
  });
  return sumGold(drops);
}

// "Дроп с Прайм" (правая половина объединённой ячейки) — только дроп,
// вручную добавленный сразу на склад ХД с категорией "Прайм" (Общий
// теперь целиком учтён в "Дроп общего инвентаря" выше, без разделения
// по category — иначе одна и та же сумма считалась бы дважды).
export async function getDropGoldPrimeManual() {
  const drops = await prisma.dropItem.findMany({
    where: { status: "Не продано", warehouse: "ХД", category: "Прайм" },
    select: { value: true, quantity: true },
  });
  return sumGold(drops);
}

// "Дроп с Мини-РБ" (левая половина объединённой ячейки) — весь остаток
// на складе ХД, кроме вручную помеченного как "Прайм".
export async function getDropGoldMiniRb() {
  const drops = await prisma.dropItem.findMany({
    where: {
      status: "Не продано",
      warehouse: "ХД",
      OR: [{ category: "Мини-РБ" }, { category: null }],
    },
    select: { value: true, quantity: true },
  });
  return sumGold(drops);
}

// Инвентарь разложен по трём складам: Общий (сюда падает дроп с Прайм-
// активностей и всё, что добавлено без активности), ХД (сюда падает дроп
// с Мини-РБ активностей, и отсюда идёт продажа) и НТ (только вручную,
// переносом из Общего). Внутри склада — предметы из журнала дропа,
// которые ещё не проданы, сгруппированные по названию для отображения
// иконками с суммарным количеством.
type InventoryEntry = {
  id: string;
  quantity: number;
  value: number;
  date: string;
  playerName: string | null;
  activityName: string | null;
};
type InventoryItem = { item: string; quantity: number; totalValue: number; imageUrl: string | null; entries: InventoryEntry[] };

export async function getInventory(): Promise<{ hd: InventoryItem[]; nt: InventoryItem[]; general: InventoryItem[] }> {
  const drops = await prisma.dropItem.findMany({
    where: { status: "Не продано" },
    include: {
      catalogItem: { select: { imageUrl: true } },
      player: { select: { name: true } },
      activity: { select: { name: true } },
    },
    orderBy: { date: "desc" },
  });

  const maps: Record<string, Map<string, InventoryItem>> = {
    ХД: new Map(),
    НТ: new Map(),
    Общий: new Map(),
  };

  for (const d of drops) {
    const map = maps[d.warehouse] ?? maps["Общий"];
    const lineValue = d.value * d.quantity;
    const existing = map.get(d.item);
    const entry: InventoryEntry = {
      id: d.id,
      quantity: d.quantity,
      value: d.value,
      date: dateFmt.format(d.date),
      playerName: d.player?.name ?? null,
      activityName: d.activity?.name ?? null,
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

  const sortByValue = (items: InventoryItem[]) => items.sort((a, b) => b.totalValue - a.totalValue);
  return {
    hd: sortByValue([...maps["ХД"].values()]),
    nt: sortByValue([...maps["НТ"].values()]),
    general: sortByValue([...maps["Общий"].values()]),
  };
}

export async function getAvgAttendanceLast30Days() {
  const since = new Date();
  since.setDate(since.getDate() - 30);
  const activities = await prisma.activity.findMany({
    where: { date: { gte: since }, archiveId: null },
    include: { _count: { select: { participants: true } } },
  });
  if (activities.length === 0) return 0;
  const total = activities.reduce((sum, a) => sum + a._count.participants, 0);
  return Math.round(total / activities.length);
}

export async function getAvgActivityDays() {
  const activities = await prisma.activity.findMany({
    where: { archiveId: null },
    orderBy: { date: "asc" },
    select: { date: true },
  });
  if (activities.length < 2) return 0;
  const first = activities[0].date.getTime();
  const last = activities[activities.length - 1].date.getTime();
  const days = (last - first) / (1000 * 60 * 60 * 24);
  return Math.round(days / (activities.length - 1));
}

export async function getAttendanceChartData() {
  const activities = await prisma.activity.findMany({
    where: { archiveId: null },
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

/**
 * Какие П/М-выплаты уже проведены в текущем расчётном периоде — для
 * переключателя статуса в «Расчёте распределения». Ключ — `${playerId}:${category}`.
 */
export async function getPayoutStatusMap(period: string): Promise<Set<string>> {
  const rows = await prisma.payment.findMany({
    where: { source: "payout", archiveMonth: period, status: "Выплачено", category: { not: null } },
    select: { playerId: true, category: true },
  });
  return new Set(rows.map((r) => `${r.playerId}:${r.category}`));
}


/** Сколько игроку выплачено (по обеим казнам) в рамках указанного периода — для «Состава». */
export async function getPlayerPeriodPaidMap(periodId: string): Promise<Map<string, number>> {
  const rows = await prisma.payment.groupBy({
    by: ["playerId"],
    where: { periodId, source: "payout", status: "Выплачено" },
    _sum: { amount: true },
  });
  return new Map(rows.map((r) => [r.playerId, r._sum.amount ?? 0]));
}

/** Сводка за диапазон дат ДО архивации — сколько активностей/операций попадёт в архив и сколько сейчас в казне. */
export async function getArchivePreview(dateFrom: Date, dateTo: Date) {
  const dateWhere = { gte: dateFrom, lte: dateTo };
  // Совпадает с тем, что реально заархивирует POST /api/archive: выплаты
  // ЗП архивируются все, независимо от даты (см. комментарий там же).
  const [activityCount, txCount, treasury] = await Promise.all([
    prisma.activity.count({ where: { date: dateWhere, archiveId: null } }),
    prisma.treasuryTransaction.count({ where: { archiveId: null, OR: [{ date: dateWhere }, { kind: "payout" }] } }),
    getTreasuryBreakdown(),
  ]);
  return {
    activityCount,
    transactionCount: txCount,
    treasuryPrime: treasury.prime,
    treasuryMiniRb: treasury.miniRb,
    treasuryGuild: treasury.guild,
  };
}

/** Список архивов, новые сверху — для раздела «Экономика → Архив». */
export async function getArchives() {
  const archives = await prisma.archive.findMany({
    orderBy: { dateFrom: "desc" },
    include: { _count: { select: { activities: true, transactions: true, playerStats: true } } },
  });
  // Итог по каждому архиву считаем тем же кодом, что и живую казну —
  // иначе в списке стояла бы одна сумма, а внутри архива другая.
  const breakdowns = await Promise.all(
    archives.map(async (a) => [a.id, await getTreasuryBreakdown({ archiveId: a.id })] as const)
  );
  const totalByArchive = new Map(breakdowns.map(([id, b]) => [id, b.total]));
  return archives.map((a) => ({
    id: a.id,
    label: a.label,
    dateFrom: a.dateFrom,
    dateTo: a.dateTo,
    createdAt: a.createdAt,
    createdBy: a.createdBy,
    activityCount: a._count.activities,
    transactionCount: a._count.transactions,
    playerCount: a._count.playerStats,
    treasuryTotal: totalByArchive.get(a.id) ?? 0,
  }));
}

/** Один архив с полным содержимым — для страницы просмотра. */
export async function getArchiveDetail(id: string) {
  const archive = await prisma.archive.findUnique({
    where: { id },
    include: {
      activities: {
        orderBy: { date: "desc" },
        include: {
          _count: { select: { participants: true, guests: true, screenshots: true } },
          drops: { select: { value: true, quantity: true } },
        },
      },
      transactions: { orderBy: { date: "desc" } },
      playerStats: { orderBy: [{ attendancePct: "desc" }, { playerName: "asc" }] },
    },
  });
  if (!archive) return null;

  // Тот же расчёт, что и для живой казны, только по книгам этого архива.
  // Наивная сумма по полю category здесь была неверной: у продаж дропа
  // category обычно пустая, категория лежит на проданных позициях — поэтому
  // Мини-РБ недосчитывался, всё сваливалось в Прайм, резерв гильдии не
  // удерживался и итог не сходился с реальной казной.
  const breakdown = await getTreasuryBreakdown({ archiveId: archive.id });

  return {
    id: archive.id,
    label: archive.label,
    dateFrom: archive.dateFrom,
    dateTo: archive.dateTo,
    createdAt: archive.createdAt,
    createdBy: archive.createdBy,
    treasuryPrime: breakdown.prime,
    treasuryMiniRb: breakdown.miniRb,
    treasuryGuild: breakdown.guild,
    treasuryTotal: breakdown.total,
    activities: archive.activities.map((a) => ({
      id: a.id,
      name: a.name,
      category: a.category,
      mode: a.mode,
      difficulty: a.difficulty,
      status: a.status,
      isNight: a.isNight,
      date: dateFmt.format(a.date),
      participants: a._count.participants,
      guests: a._count.guests,
      screenshots: a._count.screenshots,
      dropTotal: a.drops.reduce((sum, d) => sum + d.value * d.quantity, 0),
      dropCount: a.drops.length,
    })),
    playerStats: archive.playerStats.map((s) => ({
      id: s.id,
      playerId: s.playerId,
      playerName: s.playerName,
      role: s.role,
      attendancePct: s.attendancePct,
      attendancePctPrime: s.attendancePctPrime,
      attendancePctMiniRb: s.attendancePctMiniRb,
      pvpCount: s.pvpCount,
      attended: s.attended,
      activitiesTotal: s.activitiesTotal,
      salaryPrime: s.salaryPrime,
      salaryMiniRb: s.salaryMiniRb,
      salary: s.salaryPrime + s.salaryMiniRb,
    })),
    transactions: archive.transactions.map((t) => ({
      id: t.id,
      description: t.description,
      amount: t.amount,
      category: t.category,
      kind: t.kind,
      date: t.date,
    })),
  };
}

/**
 * Лёгкий список для подбора баннера по названию активности (без тяжёлого
 * imageUrl — баннеры теперь бывают видео до ~12 МБ каждый). isVideo нужен
 * только чтобы решить, рендерить <video> или <img> — сам imageUrl потребители
 * не встраивают в страницу вовсе, а ссылаются на /api/activity-banners/[id]/media,
 * иначе Next заново дублирует эти пропсы в hydration-payload поверх HTML.
 */
export async function getActivityBannerNames() {
  return prisma.activityBanner.findMany({
    select: {
      id: true,
      name: true,
      isVideo: true,
      height: true,
      widthPct: true,
      imgWidth: true,
      imgHeight: true,
    },
    orderBy: { name: "asc" },
  });
}

/**
 * Состав архивного периода с суммами к выплате — для страницы «Выплаты»,
 * когда выбран закрытый период.
 *
 * Суммы берутся из снимка (ArchivePlayerStat), а не пересчитываются: живая
 * казна после архивации нулевая, пересчёт дал бы всем нули. Статус
 * «Выплачено» — из Payment, как и у текущего периода, чтобы источник правды
 * был один.
 */
export async function getArchivePayout(archiveId: string) {
  const archive = await prisma.archive.findUnique({
    where: { id: archiveId },
    include: { playerStats: { orderBy: [{ playerName: "asc" }] } },
  });
  if (!archive) return null;

  const paid = await prisma.payment.findMany({
    where: { source: "payout", archiveMonth: archiveId, status: "Выплачено", category: { not: null } },
    select: { playerId: true, category: true, amount: true },
  });
  const paidKeys = new Set(paid.map((p) => `${p.playerId}:${p.category}`));
  const paidTotal = paid.reduce((s, p) => s + p.amount, 0);

  const players = archive.playerStats.map((s) => ({
    id: s.playerId,
    statId: s.id,
    name: s.playerName,
    role: s.role,
    attendancePctPrime: s.attendancePctPrime,
    attendancePctMiniRb: s.attendancePctMiniRb,
    salaryPrime: s.salaryPrime,
    salaryMiniRb: s.salaryMiniRb,
    salary: s.salaryPrime + s.salaryMiniRb,
    paidPrime: s.playerId ? paidKeys.has(`${s.playerId}:Прайм`) : false,
    paidMiniRb: s.playerId ? paidKeys.has(`${s.playerId}:Мини-РБ`) : false,
  }));

  const total = players.reduce((s, p) => s + p.salary, 0);
  return {
    id: archive.id,
    label: archive.label,
    createdAt: archive.createdAt,
    players,
    total,
    paidTotal,
    remaining: total - paidTotal,
    recipients: players.filter((p) => p.salary > 0).length,
  };
}

/** Список архивов для выпадающего списка «Выплата за период». */
export async function getArchiveOptions() {
  const archives = await prisma.archive.findMany({
    orderBy: { dateFrom: "desc" },
    include: { _count: { select: { playerStats: true } } },
  });
  return archives.map((a) => ({ id: a.id, label: a.label, hasRoster: a._count.playerStats > 0 }));
}
