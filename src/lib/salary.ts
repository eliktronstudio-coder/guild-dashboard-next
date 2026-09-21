import { splitProportionally } from "@/lib/proportionalSplit";

/**
 * Расчёт долей зарплаты — общий для живой страницы выплат и для снимка,
 * который делается при архивации периода.
 *
 * Вынесен отдельно от queries.ts, потому что архиву нужен тот же расчёт, но по
 * другому набору данных. Копия разъехалась бы с оригиналом, и в архиве лежали
 * бы суммы, которых сайт никогда не показывал.
 */

/**
 * Игрок с посещаемостью по категории ниже этого порога в расчёте зарплаты за
 * эту категорию не участвует вовсе — не платит и не получает. Его доля
 * пропорционально расходится между остальными.
 */
export const SALARY_MIN_ATTENDANCE_PCT = 20;

export type SalaryPlayer = { id: string; salaryCoefficient: number };

/**
 * Делит пул между игроками пропорционально посещаемости, скорректированной
 * индивидуальным коэффициентом (0.0–1.25).
 *
 * Метод наибольшего остатка, а не округление каждой доли по отдельности: при
 * round() сумма долей не сходилась с казной и часть золота просто исчезала из
 * выплат — до нескольких десятков на большом составе.
 */
export function computeSalaryMap(
  players: SalaryPlayer[],
  attendanceMap: Map<string, number>,
  pool: number
): Map<string, number> {
  const map = new Map<string, number>();
  if (pool <= 0) {
    for (const p of players) map.set(p.id, 0);
    return map;
  }

  const weights = players.map((p) => {
    const pct = attendanceMap.get(p.id) ?? 0;
    const eligible = pct >= SALARY_MIN_ATTENDANCE_PCT;
    return { item: p.id, weight: eligible ? pct * p.salaryCoefficient : 0 };
  });

  const totalWeight = weights.reduce((sum, w) => sum + w.weight, 0);
  if (totalWeight <= 0) {
    for (const p of players) map.set(p.id, 0);
    return map;
  }

  for (const p of players) map.set(p.id, 0);
  for (const share of splitProportionally(weights, pool)) {
    map.set(share.item, share.amount);
  }
  return map;
}
