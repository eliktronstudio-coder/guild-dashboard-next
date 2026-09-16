// Выплата всегда 15-го числа месяца — считаем автоматически, без ручной даты.
const PAYOUT_DAY = 15;

export function nextPayoutDate(): Date {
  const now = new Date();
  return now.getDate() <= PAYOUT_DAY
    ? new Date(now.getFullYear(), now.getMonth(), PAYOUT_DAY)
    : new Date(now.getFullYear(), now.getMonth() + 1, PAYOUT_DAY);
}

export function daysUntilNextPayout(): number {
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  return Math.round((nextPayoutDate().getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
}

/**
 * @deprecated Период выплат теперь — цикл 15→15 с собственным ID
 * (см. src/lib/period.ts, getActivePeriodId()), а не календарный месяц.
 * Функция оставлена только как алиас на случай прямого импорта из старого
 * кода; новый код должен использовать getActivePeriodId() напрямую.
 */
export { getActivePeriodId as currentPayoutPeriod } from "@/lib/period";
