/**
 * Время торгов: границы длительности и формат остатка.
 *
 * Отдельным модулем от src/lib/auction.ts, потому что этим пользуется и доска
 * в браузере. Сам auction.ts тянет Prisma, и импорт из клиентского компонента
 * затаскивал бы серверные модули в бандл — сборка на этом падает.
 */

/** Границы таймера: меньше пяти секунд бессмысленно, 30 суток — потолок. */
export const MIN_DURATION_SEC = 5;
export const MAX_DURATION_SEC = 30 * 24 * 60 * 60;

export function clampDuration(sec: number) {
  return Math.min(MAX_DURATION_SEC, Math.max(MIN_DURATION_SEC, Math.round(sec)));
}

/**
 * Остаток в виде «2 д 05:14:03» / «1:23:45» / «5:14».
 *
 * Дни и часы показываем только когда они есть: у двухминутных торгов
 * «0 д 00:01:53» читалось бы хуже, чем «1:53», а у трёхдневных «4320:00»
 * не читалось бы вовсе.
 */
export function formatRemaining(ms: number) {
  const total = Math.max(0, Math.ceil(ms / 1000));
  const days = Math.floor(total / 86400);
  const hours = Math.floor((total % 86400) / 3600);
  const minutes = Math.floor((total % 3600) / 60);
  const seconds = total % 60;
  const pad = (n: number) => String(n).padStart(2, "0");

  if (days > 0) return `${days} д ${pad(hours)}:${pad(minutes)}:${pad(seconds)}`;
  if (hours > 0) return `${hours}:${pad(minutes)}:${pad(seconds)}`;
  return `${minutes}:${pad(seconds)}`;
}
