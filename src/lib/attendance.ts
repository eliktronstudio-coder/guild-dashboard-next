import { resolveAttendanceFund } from "@/lib/activityWeights";

/**
 * Математика посещаемости, общая для живых страниц и архива.
 *
 * Вынесена из queries.ts отдельным модулем потому, что архиву нужны ровно те
 * же проценты, но по другому набору активностей (заархивированные вместо
 * активных). Копия расчёта рано или поздно разъехалась бы с оригиналом, и в
 * архиве лежали бы цифры, которых игрок никогда не видел на сайте.
 */

export type ActivityForAttendance = {
  name: string;
  category: string;
  mode: string;
  weight: number;
  participants: { playerId: string }[];
};

/** Доля активностей, в которых игрок участвовал, в процентах. */
export function buildAttendanceMap(activities: { participants: { playerId: string }[] }[]): Map<string, number> {
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

/** То же, но активности весят по-разному (лёгкий контент 0.5, разъярённые 1.5 и т.д.). */
export function buildWeightedAttendanceMap(
  activities: { weight: number; participants: { playerId: string }[] }[]
): Map<string, number> {
  const weights = activities.map((a) => a.weight);
  const totalWeight = weights.reduce((s, w) => s + w, 0);
  const map = new Map<string, number>();
  if (totalWeight <= 0) return map;

  const weightByPlayer = new Map<string, number>();
  activities.forEach((a, i) => {
    for (const p of a.participants) {
      weightByPlayer.set(p.playerId, (weightByPlayer.get(p.playerId) ?? 0) + weights[i]);
    }
  });
  for (const [playerId, w] of weightByPlayer) {
    map.set(playerId, Math.round((w / totalWeight) * 100));
  }
  return map;
}

/** Просто «сколько раз сходил» — не процент. */
export function buildCountMap(activities: { participants: { playerId: string }[] }[]): Map<string, number> {
  const map = new Map<string, number>();
  for (const a of activities) {
    for (const p of a.participants) {
      map.set(p.playerId, (map.get(p.playerId) ?? 0) + 1);
    }
  }
  return map;
}

export type AttendanceMaps = {
  overall: Map<string, number>;
  prime: Map<string, number>;
  miniRb: Map<string, number>;
  pvpCount: Map<string, number>;
  /** Сколько активностей игрок посетил — для «был на N из M». */
  attended: Map<string, number>;
  totals: { overall: number; prime: number; miniRb: number };
};

/**
 * Считает все срезы посещаемости по переданному набору активностей.
 *
 * Какая казна засчитывает активность — определяется по названию
 * (resolveAttendanceFund), а НЕ по категории, выбранной админом при создании:
 * АГЛ/АГЛ Т2/Кошка всегда Мини-РБ, всё остальное — Прайм, PvP — всегда Прайм.
 */
export function computeAttendanceMaps(activities: ActivityForAttendance[]): AttendanceMaps {
  const prime = activities.filter((a) => resolveAttendanceFund(a.name, a.mode) === "Прайм");
  const miniRb = activities.filter((a) => resolveAttendanceFund(a.name, a.mode) === "Мини-РБ");

  return {
    overall: buildAttendanceMap(activities),
    prime: buildWeightedAttendanceMap(prime),
    miniRb: buildAttendanceMap(miniRb),
    pvpCount: buildCountMap(activities.filter((a) => a.mode === "PvP")),
    attended: buildCountMap(activities),
    totals: { overall: activities.length, prime: prime.length, miniRb: miniRb.length },
  };
}
