import { prisma } from "@/lib/prisma";

/** Расчётный период идёт с 15-го числа одного месяца по 15-е следующего. */
const PERIOD_START_DAY = 15;

const labelFmt = new Intl.DateTimeFormat("ru-RU", { day: "2-digit", month: "2-digit", year: "numeric" });

export function periodLabel(startDate: Date, endDate: Date): string {
  return `${labelFmt.format(startDate)} — ${labelFmt.format(endDate)}`;
}

/** Границы 15→15 цикла, содержащего указанную дату. */
export function computePeriodBounds(date: Date): { startDate: Date; endDate: Date } {
  const y = date.getFullYear();
  const m = date.getMonth();
  const d = date.getDate();

  const startDate = d >= PERIOD_START_DAY ? new Date(y, m, PERIOD_START_DAY) : new Date(y, m - 1, PERIOD_START_DAY);
  const endDate = new Date(startDate.getFullYear(), startDate.getMonth() + 1, PERIOD_START_DAY);
  return { startDate, endDate };
}

/**
 * Возвращает текущий активный расчётный период. Нет архива и ручного
 * закрытия — период просто автоматически сменяется на следующий 15→15
 * цикл, как только реальная дата переходит его endDate: старый помечается
 * closed (без снимка задолженности), новый создаётся с чистой посещаемостью.
 */
export async function getActivePeriod() {
  const now = new Date();
  const active = await prisma.accountingPeriod.findMany({
    where: { status: "active" },
    orderBy: { startDate: "desc" },
  });

  // Если активных вдруг несколько, берём тот, внутри которого мы сейчас, а не
  // просто самый поздний: иначе один лишний период "в будущем" навсегда
  // перетянул бы на себя весь учёт.
  const existing = active.find((p) => p.startDate <= now && p.endDate > now) ?? active[0] ?? null;

  const { startDate, endDate } = computePeriodBounds(now);

  // Период, который ещё не начался, — всегда порча данных: такой оставила
  // после себя удалённая кнопка ручного закрытия (она считала следующий цикл
  // от endDate закрываемого периода, а не от текущей даты, и при досрочном
  // закрытии уезжала на месяц вперёд). Чиним на месте, а не создаём новый:
  // к этому периоду уже привязаны активности и операции, и закрыть его значило
  // бы обнулить всю посещаемость.
  if (existing && existing.startDate > now) {
    return prisma.accountingPeriod.update({
      where: { id: existing.id },
      data: { startDate, endDate, label: periodLabel(startDate, endDate) },
    });
  }

  if (existing && existing.endDate > now) return existing;

  if (existing) {
    // Реальное время обогнало период (сайт не открывали несколько дней) —
    // закрываем старый и открываем актуальный цикл одной транзакцией.
    const [, created] = await prisma.$transaction([
      prisma.accountingPeriod.update({ where: { id: existing.id }, data: { status: "closed", closedAt: now } }),
      prisma.accountingPeriod.create({
        data: { startDate, endDate, label: periodLabel(startDate, endDate), status: "active" },
      }),
    ]);
    return created;
  }

  return prisma.accountingPeriod.create({
    data: { startDate, endDate, label: periodLabel(startDate, endDate), status: "active" },
  });
}

export async function getActivePeriodId(): Promise<string> {
  const period = await getActivePeriod();
  return period.id;
}

/** Сколько дней осталось до конца активного периода (может быть <0, если пора закрывать). */
export function daysUntilPeriodEnd(endDate: Date): number {
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  return Math.round((endDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
}
