import { prisma } from "@/lib/prisma";
import { DEFAULT_TIERS, type TierDef } from "@/lib/achievements/tiers";

/**
 * Настройка порогов достижений администратором.
 *
 * На старте действуют ровно значения из задания — 10/20/50/100/500/1000 —
 * и их нельзя тихо поменять ради баланса. Но админ может позже осознанно
 * задать другие пороги для ВСЕХ цепочек разом; редкость, очки и римские
 * цифры ступеней при этом не меняются, меняется только то, сколько единиц
 * нужно набрать.
 */
const THRESHOLDS_KEY = "achievement_tier_thresholds";

function isValidThresholds(value: unknown): value is number[] {
  if (!Array.isArray(value) || value.length !== 6) return false;
  return value.every((n, i) => {
    if (typeof n !== "number" || !Number.isFinite(n) || n <= 0 || !Number.isInteger(n)) return false;
    // Строго возрастают: иначе перескочить со ступени III на IV было бы
    // легче, чем с I на II, и «накопительность» порогов сломалась бы.
    return i === 0 || n > value[i - 1];
  });
}

/** Текущие пороги — из настроек, если админ их менял, иначе значения по умолчанию. */
export async function getTierThresholds(): Promise<number[]> {
  const row = await prisma.appSetting.findUnique({ where: { key: THRESHOLDS_KEY } });
  if (!row) return DEFAULT_TIERS.map((t) => t.threshold);
  try {
    const parsed = JSON.parse(row.value);
    if (isValidThresholds(parsed)) return parsed;
  } catch {
    // испорченное значение в базе — откатываемся к дефолту, не падаем
  }
  return DEFAULT_TIERS.map((t) => t.threshold);
}

export type ThresholdUpdateResult = { ok: true } | { ok: false; error: string };

/** Сохраняет новые пороги. Редкость/очки/римские цифры берутся из DEFAULT_TIERS. */
export async function setTierThresholds(thresholds: number[]): Promise<ThresholdUpdateResult> {
  if (!isValidThresholds(thresholds)) {
    return { ok: false, error: "Пороги должны быть шестью целыми положительными числами по возрастанию." };
  }
  await prisma.appSetting.upsert({
    where: { key: THRESHOLDS_KEY },
    create: { key: THRESHOLDS_KEY, value: JSON.stringify(thresholds) },
    update: { value: JSON.stringify(thresholds) },
  });
  return { ok: true };
}

/** Собирает полные TierDef[] — берёт пороги из настроек, остальное из DEFAULT_TIERS. */
export function buildTiersFromThresholds(thresholds: number[]): TierDef[] {
  return DEFAULT_TIERS.map((t, i) => ({ ...t, threshold: thresholds[i] }));
}

/** Пороги, реально применяемые сейчас, уже в виде TierDef[]. */
export async function getActiveTiers(): Promise<TierDef[]> {
  return buildTiersFromThresholds(await getTierThresholds());
}
