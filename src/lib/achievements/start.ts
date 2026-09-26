import { prisma } from "@/lib/prisma";

/**
 * Дата запуска системы достижений.
 *
 * Всё, что было до неё, не засчитывается: система стартует с нуля. Дата
 * записывается в базу один раз и дальше не меняется — ни при перезапуске
 * приложения, ни при миграции, ни при повторном вызове этой функции.
 *
 * Именно поэтому здесь create с перехватом конфликта, а не upsert: upsert
 * переписал бы значение, и вся гильдия разом получила бы «новый» прогресс за
 * старые заслуги.
 */
export const ACHIEVEMENTS_STARTED_AT_KEY = "achievements_started_at";

/** Ошибка уникальности в Prisma — запись успели создать параллельно. */
function isUniqueViolation(err: unknown) {
  return typeof err === "object" && err !== null && (err as { code?: string }).code === "P2002";
}

export async function getAchievementsStartedAt(now = new Date()): Promise<Date> {
  const existing = await prisma.appSetting.findUnique({ where: { key: ACHIEVEMENTS_STARTED_AT_KEY } });
  if (existing) return new Date(existing.value);

  try {
    const created = await prisma.appSetting.create({
      data: { key: ACHIEVEMENTS_STARTED_AT_KEY, value: now.toISOString() },
    });
    return new Date(created.value);
  } catch (err) {
    // Двое запросов пришли одновременно и оба увидели пустоту — побеждает
    // тот, кто записал первым, второй просто читает готовое значение.
    if (!isUniqueViolation(err)) throw err;
    const again = await prisma.appSetting.findUnique({ where: { key: ACHIEVEMENTS_STARTED_AT_KEY } });
    if (!again) throw err;
    return new Date(again.value);
  }
}

/**
 * Событие засчитывается, только если произошло не раньше запуска системы.
 *
 * Проверяем дату самого события, а не дату записи: импорт старого боя,
 * заведённый сегодня, прогресса дать не должен.
 */
export function countsTowardAchievements(eventDate: Date, startedAt: Date): boolean {
  return eventDate.getTime() >= startedAt.getTime();
}

/**
 * С какого момента считать стаж игрока: позже из запуска системы и даты
 * вступления. Тому, кто пришёл после запуска, стаж идёт с его прихода.
 */
export function tenureStart(joinedAt: Date, startedAt: Date): Date {
  return joinedAt.getTime() > startedAt.getTime() ? joinedAt : startedAt;
}

/** Полных дней между двумя датами, не меньше нуля. */
export function daysBetween(from: Date, to: Date): number {
  const ms = to.getTime() - from.getTime();
  if (!Number.isFinite(ms) || ms <= 0) return 0;
  return Math.floor(ms / 86_400_000);
}
