/**
 * Ступени достижений: пороги, редкость, очки.
 *
 * Чистый модуль без обращений к базе — им пользуются и расчёт прогресса, и
 * страницы, и тесты. Ничего отсюда не должно зависеть от Prisma, иначе
 * клиентские карточки затащили бы серверный код в бандл.
 */

export const RARITIES = ["Обычная", "Необычная", "Редкая", "Эпическая", "Легендарная", "Мифическая"] as const;
export type Rarity = (typeof RARITIES)[number];

export type TierDef = {
  /** Номер ступени, 1..6. */
  level: number;
  /** Римская цифра для карточки. */
  roman: string;
  /** Накопительный порог: сколько единиц всего нужно набрать. */
  threshold: number;
  rarity: Rarity;
  points: number;
};

/**
 * Пороги накопительные: II даётся на 20 единицах всего, а не на 20 сверх
 * первых 10. Ровно как в задании — 10 / 20 / 50 / 100 / 500 / 1000.
 */
export const DEFAULT_TIERS: readonly TierDef[] = [
  { level: 1, roman: "I", threshold: 10, rarity: "Обычная", points: 10 },
  { level: 2, roman: "II", threshold: 20, rarity: "Необычная", points: 20 },
  { level: 3, roman: "III", threshold: 50, rarity: "Редкая", points: 30 },
  { level: 4, roman: "IV", threshold: 100, rarity: "Эпическая", points: 50 },
  { level: 5, roman: "V", threshold: 500, rarity: "Легендарная", points: 100 },
  { level: 6, roman: "VI", threshold: 1000, rarity: "Мифическая", points: 200 },
];

/** Максимум очков за одну цепочку — 410. */
export const MAX_POINTS_PER_CHAIN = DEFAULT_TIERS.reduce((s, t) => s + t.points, 0);

export type ChainProgress = {
  /** Сколько единиц набрано. */
  value: number;
  /** Последняя взятая ступень, 0 — ни одной. */
  level: number;
  /** Очки за все взятые ступени. */
  points: number;
  /** Следующая цель; null — максимальный уровень. */
  next: TierDef | null;
  /** Сколько единиц уже засчитано в текущую ступень. */
  inTier: number;
  /** Сколько единиц нужно на текущую ступень целиком. */
  tierSize: number;
  /** Доля закрытия текущей ступени, 0..1. Взят максимум — 1. */
  ratio: number;
  /** Сколько единиц осталось до следующей ступени; null на максимуме. */
  remaining: number | null;
  maxed: boolean;
};

/**
 * Считает состояние цепочки по набранному значению.
 *
 * Игрок мог перепрыгнуть несколько порогов разом (например, импортировали
 * сразу 120 единиц) — тогда ему полагаются все пройденные ступени и сумма
 * их очков, а не только последняя.
 */
export function chainProgress(value: number, tiers: readonly TierDef[] = DEFAULT_TIERS): ChainProgress {
  const safe = Number.isFinite(value) ? Math.max(0, Math.floor(value)) : 0;

  const earned = tiers.filter((t) => safe >= t.threshold);
  const level = earned.length;
  const points = earned.reduce((s, t) => s + t.points, 0);
  const next = tiers[level] ?? null;

  if (!next) {
    const last = tiers[tiers.length - 1];
    return {
      value: safe,
      level,
      points,
      next: null,
      inTier: last?.threshold ?? 0,
      tierSize: last?.threshold ?? 0,
      ratio: 1,
      remaining: null,
      maxed: true,
    };
  }

  // Полоса показывает закрытие ТЕКУЩЕЙ ступени, а не всей цепочки: иначе на
  // пути с 500 к 1000 она почти не двигалась бы неделями.
  const floor = level > 0 ? tiers[level - 1].threshold : 0;
  const tierSize = next.threshold - floor;
  const inTier = safe - floor;

  return {
    value: safe,
    level,
    points,
    next,
    inTier,
    tierSize,
    ratio: tierSize > 0 ? Math.min(1, inTier / tierSize) : 0,
    remaining: next.threshold - safe,
    maxed: false,
  };
}

/**
 * Какие ступени игрок получил впервые при переходе со старого значения на
 * новое. Нужно, чтобы выдать очки ровно один раз и не задвоить их при
 * повторном пересчёте.
 */
export function newlyEarnedTiers(
  previousValue: number,
  nextValue: number,
  tiers: readonly TierDef[] = DEFAULT_TIERS
): TierDef[] {
  const before = chainProgress(previousValue, tiers).level;
  const after = chainProgress(nextValue, tiers).level;
  if (after <= before) return [];
  return tiers.slice(before, after);
}
