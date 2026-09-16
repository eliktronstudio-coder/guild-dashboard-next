import StatCard from "@/components/StatCard";
import PayoutSummaryTable from "@/components/admin/PayoutSummaryTable";
import PaymentsTable from "@/components/admin/PaymentsTable";
import FreezeSalaryButton from "@/components/admin/FreezeSalaryButton";
import BlurValue from "@/components/BlurValue";
import { getActivePeriod, daysUntilPeriodEnd } from "@/lib/period";
import ClosePeriodButton from "@/components/admin/ClosePeriodButton";
import Link from "next/link";
import {
  getAllPayments,
  getAllPlayers,
  getPayoutSnapshotMap,
  getPayoutStatusMap,
  getTreasuryBreakdown,
} from "@/lib/queries";
import { getCurrentUser } from "@/lib/auth";
import { isFullAdminRole } from "@/lib/accountRoles";

const dateFmt = new Intl.DateTimeFormat("ru-RU", { day: "numeric", month: "long" });
const numberFmt = new Intl.NumberFormat("ru-RU");

export default async function PaymentsPage() {
  const activePeriod = await getActivePeriod();
  const period = activePeriod.id;
  const [payments, players, user, treasury, paidStatus, snapshot] = await Promise.all([
    getAllPayments(),
    getAllPlayers(),
    getCurrentUser(),
    getTreasuryBreakdown(),
    getPayoutStatusMap(period),
    getPayoutSnapshotMap(period),
  ]);

  // Если зарплата зафиксирована кнопкой «Зарплата», берём суммы из снимка —
  // иначе они пересчитывались бы от остатка казны при каждой следующей
  // выплате, и уже показанные игрокам цифры «плыли» бы. Игроков, которых
  // не было в момент фиксации (снимок их не покрывает), считаем как обычно.
  const effective = players.map((p) => {
    const frozen = snapshot.get(p.id);
    const salaryPrime = frozen?.salaryPrime ?? p.salaryPrime;
    const salaryMiniRb = frozen?.salaryMiniRb ?? p.salaryMiniRb;
    return { ...p, salaryPrime, salaryMiniRb, salary: salaryPrime + salaryMiniRb };
  });

  const totalPayout = effective.reduce((sum, p) => sum + p.salary, 0);
  const recipients = effective.filter((p) => p.salary > 0).length;
  const isRandom = user?.role === "random";
  const isAdmin = isFullAdminRole(user?.role);
  const hasSnapshot = snapshot.size > 0;

  // Сколько уже фактически списано в этом периоде — нужно для сверки ниже:
  // после первой же выплаты остаток казны уменьшается, а totalPayout при
  // зафиксированной зарплате остаётся прежним, так что напрямую их сравнивать
  // уже нельзя.
  const paidThisPeriod = payments
    .filter((p) => p.source === "payout" && p.archiveMonth === period && p.status === "Выплачено")
    .reduce((sum, p) => sum + p.amount, 0);

  // Сверка: остаток казны обязан равняться тому, что ещё не выплачено.
  const pool = treasury.prime + treasury.miniRb;
  const undistributed = pool - (totalPayout - paidThisPeriod);

  const daysLeft = daysUntilPeriodEnd(activePeriod.endDate);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-border bg-surface px-4 py-3">
        <div className="text-sm">
          <span className="text-muted">Текущий расчётный период: </span>
          <span className="font-medium">{activePeriod.label}</span>
        </div>
        <span className="inline-flex items-center gap-1.5 text-xs font-medium text-success">
          <span className="h-2 w-2 rounded-full bg-success" /> Активный
          {daysLeft >= 0 ? ` · осталось ${daysLeft} дн.` : " · период завершён, доступна архивация"}
        </span>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <StatCard label="Конец периода" value={dateFmt.format(activePeriod.endDate)} hint={daysLeft >= 0 ? `через ${daysLeft} дн.` : "период завершён"} />
        <BlurValue blurred={isRandom}>
          <StatCard label="Сумма к выплате" value={`${numberFmt.format(totalPayout)} золота`} hint="расчётная сумма" />
        </BlurValue>
        <StatCard label="Получателей" value={String(recipients)} hint="игроков с ненулевой долей" />
      </div>

      {!isRandom && (
        <div
          className={`rounded-lg border px-4 py-3 text-sm ${
            undistributed === 0 ? "border-border bg-surface text-muted" : "border-danger/40 bg-danger/10 text-danger"
          }`}
        >
          {undistributed === 0 ? (
            <>
              Сверка сошлась: остаток казны Прайма и Мини-РБ —{" "}
              <span className="font-mono tabular-nums text-foreground">{numberFmt.format(pool)}</span> золота —
              равен ещё не выплаченной части фонда. Если игрока удалить, его доля автоматически уйдёт остальным.
            </>
          ) : (
            <>
              Не сходится{" "}
              <span className="font-mono tabular-nums">{numberFmt.format(undistributed)}</span> золота. Это ошибка
              расчёта — сообщите разработчику.
            </>
          )}
        </div>
      )}

      {isAdmin && (
        <div className="flex flex-wrap items-center gap-2">
          <FreezeSalaryButton alreadyFrozen={hasSnapshot} />
          <ClosePeriodButton />
          <Link
            href="/archive"
            className="rounded-md border border-border bg-surface px-3 py-2 text-sm font-medium hover:bg-surface-2"
          >
            Архив периодов
          </Link>
          <Link
            href="/journal"
            className="rounded-md border border-border bg-surface px-3 py-2 text-sm font-medium hover:bg-surface-2"
          >
            Финансовый журнал
          </Link>
        </div>
      )}

      {isAdmin && daysLeft <= 1 && (
        <div className="rounded-lg border border-amber-500/40 bg-amber-500/10 px-4 py-3 text-sm text-amber-600">
          {daysLeft > 0
            ? `Расчётный период заканчивается через ${daysLeft} дн.`
            : daysLeft === 0
              ? "Расчётный период заканчивается сегодня."
              : "Расчётный период завершён. Доступна архивация."}
        </div>
      )}

      <PayoutSummaryTable
        players={effective.map((p) => ({
          id: p.id,
          name: p.name,
          role: p.role,
          attendancePctPrime: p.attendancePctPrime,
          attendancePctMiniRb: p.attendancePctMiniRb,
          salary: p.salary,
          salaryPrime: p.salaryPrime,
          salaryMiniRb: p.salaryMiniRb,
        }))}
        totalPayout={totalPayout}
        isRandom={isRandom}
        isAdmin={isAdmin}
        paidStatus={[...paidStatus]}
      />

      <PaymentsTable
        payments={payments.map((p) => ({
          id: p.id,
          player: { id: p.player.id, name: p.player.name },
          amount: p.amount,
          status: p.status,
          date: dateFmt.format(p.date),
          dateISO: p.date.toISOString().slice(0, 10),
          source: p.source,
        }))}
        players={players.map((p) => ({ id: p.id, name: p.name }))}
        isAdmin={isAdmin}
        isRandom={isRandom}
      />
    </div>
  );
}
