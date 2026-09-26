import { prisma } from "@/lib/prisma";
import { ACHIEVEMENTS, BOSS_ALIASES, type AchievementDef } from "@/lib/achievements/catalog";
import { chainProgress, type ChainProgress } from "@/lib/achievements/tiers";
import { daysBetween, getAchievementsStartedAt, tenureStart } from "@/lib/achievements/start";

/**
 * Подсчёт прогресса по реальным данным.
 *
 * Значения не хранятся, а считаются запросом. Поэтому повторный пересчёт
 * физически не может задвоить очки: они — чистая функция от значения.
 *
 * Архивные активности НЕ исключаются. Архивация только помечает записи
 * archiveId, не удаляя их, и сбрасывать из-за неё достижения нельзя —
 * заслуга никуда не делась. По той же причине не смотрим на расчётный
 * период: цикл 15→15 к достижениям отношения не имеет.
 */

export type MetricValues = Record<string, number>;

function dayKey(d: Date) {
  return d.toISOString().slice(0, 10);
}

/** Ключ босса по названию активности — через список синонимов из каталога. */
function bossKeyFromAliases(name: string): string | null {
  for (const [key, names] of Object.entries(BOSS_ALIASES)) {
    if (names.includes(name)) return key;
  }
  return null;
}

type Participation = {
  playerId: string;
  date: Date;
  category: string;
  mode: string;
  activityName: string;
  bossKey: string | null;
  bossKillConfirmed: boolean;
  killCount: number;
  pvpResult: string | null;
  pvpGuildRaid: boolean;
  guildDefense: boolean;
  fullParticipation: boolean;
};

/** Участия всех игроков в активностях, случившихся после запуска системы. */
async function loadParticipations(startedAt: Date): Promise<Participation[]> {
  const rows = await prisma.activityParticipant.findMany({
    where: { activity: { date: { gte: startedAt } } },
    select: {
      playerId: true,
      fullParticipation: true,
      activity: {
        select: {
          name: true,
          date: true,
          category: true,
          mode: true,
          bossKey: true,
          bossKillConfirmed: true,
          killCount: true,
          pvpResult: true,
          pvpGuildRaid: true,
          guildDefense: true,
        },
      },
    },
  });
  return rows.map((r) => ({
    playerId: r.playerId,
    date: r.activity.date,
    category: r.activity.category,
    mode: r.activity.mode,
    activityName: r.activity.name,
    // Ключ, проставленный вручную, приоритетнее — распознавание по названию
    // это подстраховка для записей, где его ещё не заполнили.
    bossKey: r.activity.bossKey ?? bossKeyFromAliases(r.activity.name),
    bossKillConfirmed: r.activity.bossKillConfirmed,
    killCount: Math.max(1, r.activity.killCount),
    pvpResult: r.activity.pvpResult,
    pvpGuildRaid: r.activity.pvpGuildRaid,
    guildDefense: r.activity.guildDefense,
    fullParticipation: r.fullParticipation,
  }));
}

/** Мероприятия после запуска, где игрок отмечен организатором или рейд-лидером. */
async function loadLeadershipCounts(startedAt: Date): Promise<{
  organizer: Map<string, number>;
  raidLeader: Map<string, number>;
}> {
  const rows = await prisma.activity.findMany({
    where: {
      date: { gte: startedAt },
      OR: [{ organizerPlayerId: { not: null } }, { raidLeaderPlayerId: { not: null } }],
    },
    select: { organizerPlayerId: true, raidLeaderPlayerId: true },
  });
  const organizer = new Map<string, number>();
  const raidLeader = new Map<string, number>();
  for (const r of rows) {
    if (r.organizerPlayerId) organizer.set(r.organizerPlayerId, (organizer.get(r.organizerPlayerId) ?? 0) + 1);
    if (r.raidLeaderPlayerId) raidLeader.set(r.raidLeaderPlayerId, (raidLeader.get(r.raidLeaderPlayerId) ?? 0) + 1);
  }
  return { organizer, raidLeader };
}

/**
 * Золото считается за всё время, без отсечки по дате запуска — так решено
 * отдельно от остальных метрик.
 *
 * «Начислено» и «выплачено» различаются статусом: запись о начислении
 * появляется сразу, а подтверждённой выплатой становится позже. Поэтому 23–25
 * считают все записи, а 27 — только подтверждённые.
 */
type GoldRow = { playerId: string; amount: number; category: string | null; status: string };

async function loadGold(): Promise<GoldRow[]> {
  return prisma.payment.findMany({ select: { playerId: true, amount: true, category: true, status: true } });
}

const PAID = "Выплачено";
const VICTORY = "Победа";

function emptyMetrics(): MetricValues {
  return {
    "pvp.battles": 0,
    "pvp.victories": 0,
    "pvp.guildRaids": 0,
    "pvp.defense": 0,
    "boss.kraken": 0,
    "boss.leviathan": 0,
    "boss.calidis": 0,
    "boss.xanatos": 0,
    "boss.worldAny": 0,
    "boss.miniKills": 0,
    "act.prime": 0,
    "act.mini": 0,
    "act.unique": 0,
    "act.days": 0,
    "act.full": 0,
    "help.organizer": 0,
    "help.raidLeader": 0,
    "gold.earned": 0,
    "gold.prime": 0,
    "gold.mini": 0,
    "gold.paid": 0,
    "tenure.days": 0,
    "tenure.primeDays": 0,
    "tenure.miniDays": 0,
  };
}

/** Считает значения всех обеспеченных данными метрик для каждого игрока. */
export async function getMetricsForAllPlayers(now = new Date()): Promise<Map<string, MetricValues>> {
  const startedAt = await getAchievementsStartedAt(now);

  const [players, parts, leadership, gold] = await Promise.all([
    prisma.player.findMany({ select: { id: true, createdAt: true } }),
    loadParticipations(startedAt),
    loadLeadershipCounts(startedAt),
    loadGold(),
  ]);

  const byPlayer = new Map<string, MetricValues>();
  const dayBuckets = new Map<string, { all: Set<string>; prime: Set<string>; mini: Set<string> }>();

  for (const p of players) {
    const m = emptyMetrics();
    // Стаж: от более поздней из дат — запуск системы или вступление игрока.
    m["tenure.days"] = daysBetween(tenureStart(p.createdAt, startedAt), now);
    m["help.organizer"] = leadership.organizer.get(p.id) ?? 0;
    m["help.raidLeader"] = leadership.raidLeader.get(p.id) ?? 0;
    byPlayer.set(p.id, m);
    dayBuckets.set(p.id, { all: new Set(), prime: new Set(), mini: new Set() });
  }

  for (const part of parts) {
    const m = byPlayer.get(part.playerId);
    const days = dayBuckets.get(part.playerId);
    if (!m || !days) continue; // участие удалённого игрока

    // Одно участие двигает несколько метрик сразу, но внутри каждой метрики
    // учитывается ровно один раз.
    m["act.unique"] += 1;
    days.all.add(dayKey(part.date));

    if (part.fullParticipation) m["act.full"] += 1;

    if (part.mode === "PvP") {
      m["pvp.battles"] += 1;
      if (part.pvpResult === VICTORY) m["pvp.victories"] += 1;
      if (part.pvpGuildRaid) m["pvp.guildRaids"] += 1;
      if (part.guildDefense) m["pvp.defense"] += 1;
    }

    if (part.category === "Мини-РБ") {
      m["act.mini"] += 1;
      days.mini.add(dayKey(part.date));
      // Подтверждённое убийство мини-РБ — отдельная метрика от посещения:
      // один рейд может дать несколько убийств и остаётся одним визитом.
      if (part.bossKillConfirmed) m["boss.miniKills"] += part.killCount;
    } else {
      m["act.prime"] += 1;
      days.prime.add(dayKey(part.date));
    }

    if (part.bossKillConfirmed && part.bossKey) {
      m["boss.worldAny"] += part.killCount;
      const chainKey = "boss." + part.bossKey;
      if (chainKey in m) m[chainKey] += part.killCount;
    }
  }

  for (const [playerId, days] of dayBuckets) {
    const m = byPlayer.get(playerId)!;
    m["act.days"] = days.all.size;
    m["tenure.primeDays"] = days.prime.size;
    m["tenure.miniDays"] = days.mini.size;
  }

  for (const g of gold) {
    const m = byPlayer.get(g.playerId);
    if (!m) continue;
    // Отрицательные суммы (отмены, корректировки) уменьшают начисленное:
    // иначе отменённая выплата навсегда оставалась бы заслугой.
    m["gold.earned"] += g.amount;
    if (g.category === "Мини-РБ") m["gold.mini"] += g.amount;
    else if (g.category === "Прайм") m["gold.prime"] += g.amount;
    if (g.status === PAID) m["gold.paid"] += g.amount;
  }

  return byPlayer;
}

export async function getMetricsForPlayer(playerId: string, now = new Date()): Promise<MetricValues> {
  const all = await getMetricsForAllPlayers(now);
  return all.get(playerId) ?? {};
}

export type AchievementState = AchievementDef & {
  /** Null — источник данных не настроен, прогресс не считаем. */
  progress: ChainProgress | null;
};

export type PlayerAchievements = {
  items: AchievementState[];
  totalPoints: number;
  earnedTiers: number;
  maxPoints: number;
};

/** Превращает значения метрик в состояние всех 30 цепочек. */
export function buildAchievements(metrics: MetricValues, maxPerChain: number): PlayerAchievements {
  const items = ACHIEVEMENTS.map<AchievementState>((def) => ({
    ...def,
    // У цепочек без источника прогресса нет вовсе — ноль тут был бы враньём
    // не меньшим, чем выдуманное число.
    progress: def.source === "ready" ? chainProgress(metrics[def.key] ?? 0) : null,
  }));

  return {
    items,
    totalPoints: items.reduce((s, i) => s + (i.progress?.points ?? 0), 0),
    earnedTiers: items.reduce((s, i) => s + (i.progress?.level ?? 0), 0),
    maxPoints: ACHIEVEMENTS.length * maxPerChain,
  };
}
