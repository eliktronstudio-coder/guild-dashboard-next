import StatCard from "@/components/StatCard";
import PayoutSummaryTable from "@/components/admin/PayoutSummaryTable";
import PaymentsTable from "@/components/admin/PaymentsTable";
import { daysUntilNextPayout, nextPayoutDate } from "@/lib/payout";
import { getAllPayments, getAllPlayers } from "@/lib/queries";
import { getCurrentUser } from "@/lib/auth";

const dateFmt = new Intl.DateTimeFormat("ru-RU", { day: "numeric", month: "long" });
const numberFmt = new Intl.NumberFormat("ru-RU");

export default async function PaymentsPage() {
  const [payments, players, user] = await Promise.all([getAllPayments(), getAllPlayers(), getCurrentUser()]);

  const totalPayout = players.reduce((sum, p) => sum + p.salary, 0);
  const recipients = players.filter((p) => p.salary > 0).length;

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <StatCard label="Следующая выплата" value={dateFmt.format(nextPayoutDate())} hint={`через ${daysUntilNextPayout()} дн.`} />
        <StatCard label="Сумма к выплате" value={`${numberFmt.format(totalPayout)} золота`} hint="расчётная сумма" />
        <StatCard label="Получателей" value={String(recipients)} hint="игроков с ненулевой долей" />
      </div>

      <PayoutSummaryTable
        players={players.map((p) => ({
          id: p.id,
          name: p.name,
          role: p.role,
          attendancePct: p.attendancePct,
          salary: p.salary,
        }))}
        totalPayout={totalPayout}
      />

      <PaymentsTable
        payments={payments.map((p) => ({
          id: p.id,
          player: { id: p.player.id, name: p.player.name },
          amount: p.amount,
          status: p.status,
          date: dateFmt.format(p.date),
        }))}
        players={players.map((p) => ({ id: p.id, name: p.name }))}
        isAdmin={user?.role === "admin"}
      />
    </div>
  );
}
