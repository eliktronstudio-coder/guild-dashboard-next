import { prisma } from "@/lib/prisma";
import { ACHIEVEMENTS, type AchievementDef } from "@/lib/achievements/catalog";
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

type Participation = { playerId: string; date: Date; category: string; mode: string };

/** Участия всех игроков в активностях, случившихся после запуска системы. */
async function loadParticipations(startedAt: Date): Promise<Participation[]> {
  const rows = await prisma.activityParticipant.findMany({
    where: { activity: { date: { gte: startedAt } } },
    select: { playerId: true, activity: { select: { date: true, category: true, mode: true } } },
  });
  return rows.map((r) => ({
    playerId: r.playerId,
    date: r.activity.date,
    category: r.activity.category,
    mode: r.activity.mode,
  }));
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

/** Считает значения всех обеспеченных данными метрик для каждого игрока. */
export async function getMetricsForAllPlayers(now = new Date()): Promise<Map<string, MetricValues>> {
  const startedAt = await getAchievementsStartedAt(now);

  const [players, parts, gold] = await Promise.all([
    prisma.player.findMany({ select: { id: true, createdAt: true } }),
    loadParticipations(startedAt),
    loadGold(),
  ]);

  const byPlayer = new Map<string, MetricValues>();
  const dayBuckets = new Map<string, { all: Set<string>; prime: Set<string>; mini: Set<string> }>();

  for (const p of players) {
    byPlayer.set(p.id, {
      "pvp.battles": 0,
      "act.prime": 0,
      "act.mini": 0,
      "act.unique": 0,
      "act.days": 0,
      "gold.earned": 0,
      "gold.prime": 0,
      "gold.mini": 0,
      "gold.paid": 0,
      // Стаж: от более поздней из дат — запуск системы или вступление игрока.
      "tenure.days": daysBetween(tenureStart(p.createdAt, startedAt), now),
      "tenure.primeDays": 0,
      "tenure.miniDays": 0,
    });
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

    if (part.mode === "PvP") m["pvp.battles"] += 1;

    if (part.category === "Мини-РБ") {
      m["act.mini"] += 1;
      days.mini.add(dayKey(part.date));
    } else {
      m["act.prime"] += 1;
      days.prime.add(dayKey(part.date));
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
