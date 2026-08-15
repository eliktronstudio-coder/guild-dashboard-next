// Выплата всегда 15-го числа месяца — считаем автоматически, без ручной даты.
const PAYOUT_DAY = 15;

export function daysUntilNextPayout(): number {
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const target =
    now.getDate() <= PAYOUT_DAY
      ? new Date(now.getFullYear(), now.getMonth(), PAYOUT_DAY)
      : new Date(now.getFullYear(), now.getMonth() + 1, PAYOUT_DAY);
  return Math.round((target.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
}
