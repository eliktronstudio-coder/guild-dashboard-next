const PERIOD_START_DAY = 15;

/** Границы 15→15 цикла, содержащего указанную дату. */
export function computePeriodBounds(date: Date): {
  startDate: Date;
  endDate: Date;
} {
  const y = date.getFullYear();
  const m = date.getMonth();
  const d = date.getDate();

  const startDate =
    d >= PERIOD_START_DAY
      ? new Date(y, m, PERIOD_START_DAY)
      : new Date(y, m - 1, PERIOD_START_DAY);
  const endDate = new Date(
    startDate.getFullYear(),
    startDate.getMonth() + 1,
    PERIOD_START_DAY,
  );
  return { startDate, endDate };
}
