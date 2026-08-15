import StatCard from "@/components/StatCard";
import TreasuryChart from "@/components/charts/TreasuryChart";
import TreasuryPanel from "@/components/admin/TreasuryPanel";
import { getCurrentUser } from "@/lib/auth";
import { getTreasuryTransactions, getTreasuryBreakdown, getTreasuryChartData, getGuildSettings } from "@/lib/queries";

const numberFmt = new Intl.NumberFormat("ru-RU");
const dateFmt = new Intl.DateTimeFormat("ru-RU", { day: "numeric", month: "long" });

function daysUntil(date: Date | null) {
  if (!date) return null;
  const diff = Math.ceil((date.getTime() - Date.now()) / (1000 * 60 * 60 * 24));
  return Math.max(diff, 0);
}

export default async function TreasuryPage() {
  const [user, transactions, treasuryBreakdown, chartData, settings] = await Promise.all([
    getCurrentUser(),
    getTreasuryTransactions(20),
    getTreasuryBreakdown(),
    getTreasuryChartData(),
    getGuildSettings(),
  ]);

  const payoutDays = daysUntil(settings.nextPayoutDate);

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <StatCard
          label="Основная казна"
          value={`${numberFmt.format(treasuryBreakdown.main)} золота`}
          hint="70% — фонд ЗП"
        />
        <StatCard
          label="Казна гильдии"
          value={`${numberFmt.format(treasuryBreakdown.guild)} золота`}
          hint="30% — резерв гильдии"
        />
        <StatCard
          label="Дней до выплаты"
          value={payoutDays === null ? "—" : `${payoutDays}`}
          hint="до дня выплат"
        />
      </div>

      <div className="rounded-lg border border-border bg-surface p-4">
        <h2 className="mb-2 text-sm font-semibold">Динамика казны</h2>
        <TreasuryChart data={chartData} />
      </div>

      <TreasuryPanel
        transactions={transactions.map((t) => ({ ...t, date: dateFmt.format(t.date) }))}
        settings={{
          nextPayoutDate: settings.nextPayoutDate ? settings.nextPayoutDate.toISOString() : null,
        }}
        isAdmin={user?.role === "admin"}
      />
    </div>
  );
}
