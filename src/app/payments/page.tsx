import StatCard from "@/components/StatCard";
import PayoutSummaryTable from "@/components/admin/PayoutSummaryTable";
import PaymentsTable from "@/components/admin/PaymentsTable";
import BlurValue from "@/components/BlurValue";
import { currentPayoutPeriod, daysUntilNextPayout, nextPayoutDate } from "@/lib/payout";
import { getAllPayments, getAllPlayers, getPayoutStatusMap, getTreasuryBreakdown } from "@/lib/queries";
import { getCurrentUser } from "@/lib/auth";
import { isFullAdminRole } from "@/lib/accountRoles";

const dateFmt = new Intl.DateTimeFormat("ru-RU", { day: "numeric", month: "long" });
const numberFmt = new Intl.NumberFormat("ru-RU");

export default async function PaymentsPage() {
  const [payments, players, user, treasury, paidStatus] = await Promise.all([
    getAllPayments(),
    getAllPlayers(),
    getCurrentUser(),
    getTreasuryBreakdown(),
    getPayoutStatusMap(currentPayoutPeriod()),
  ]);

  const totalPayout = players.reduce((sum, p) => sum + p.salary, 0);
  const recipients = players.filter((p) => p.salary > 0).length;
  const isRandom = user?.role === "random";
  const isAdmin = isFullAdminRole(user?.role);

  // Сверка: вся казна Прайма и Мини-РБ обязана быть роздана текущему составу.
  // Показываем её явно, чтобы недостачу было видно сразу, а не искать её
  // сравнением цифр на разных страницах.
  const pool = treasury.prime + treasury.miniRb;
  const undistributed = pool - totalPayout;

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <StatCard label="Следующая выплата" value={dateFmt.format(nextPayoutDate())} hint={`через ${daysUntilNextPayout()} дн.`} />
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
              Сверка сошлась: вся казна Прайма и Мини-РБ —{" "}
              <span className="font-mono tabular-nums text-foreground">{numberFmt.format(pool)}</span> золота —
              распределена между текущим составом ({players.length} чел.). Если игрока удалить, его доля
              автоматически уйдёт остальным.
            </>
          ) : (
            <>
              Не распределено{" "}
              <span className="font-mono tabular-nums">{numberFmt.format(undistributed)}</span> золота из{" "}
              {numberFmt.format(pool)}. Это ошибка расчёта — сообщите разработчику.
            </>
          )}
        </div>
      )}

      <PayoutSummaryTable
        players={players.map((p) => ({
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
