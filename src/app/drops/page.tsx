import StatCard from "@/components/StatCard";
import TreasuryChart from "@/components/charts/TreasuryChart";
import DropsPanel from "@/components/admin/DropsPanel";
import { getCurrentUser } from "@/lib/auth";
import { getAllDrops, getDropGoldTotal, getDropChartData, getAllActivities, getRegisteredPlayers } from "@/lib/queries";

const numberFmt = new Intl.NumberFormat("ru-RU");
const dateFmt = new Intl.DateTimeFormat("ru-RU", { day: "numeric", month: "long" });

export default async function DropsPage() {
  const [user, drops, total, chartData, activities, players] = await Promise.all([
    getCurrentUser(),
    getAllDrops(50),
    getDropGoldTotal(),
    getDropChartData(),
    getAllActivities(),
    getRegisteredPlayers(),
  ]);

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <StatCard label="Дроп с РБ" value={`${numberFmt.format(total)} золота`} hint="суммарно из журнала" />
        <StatCard label="Записей в журнале" value={String(drops.length)} hint="за всё время" />
      </div>

      <div className="rounded-lg border border-border bg-surface p-4">
        <h2 className="mb-2 text-sm font-semibold">Динамика дропа</h2>
        <TreasuryChart data={chartData} />
      </div>

      <DropsPanel
        drops={drops.map((d) => ({
          id: d.id,
          item: d.item,
          value: d.value,
          date: dateFmt.format(d.date),
          activityName: d.activity?.name ?? null,
          playerName: d.player?.name ?? null,
        }))}
        activities={activities.map((a) => ({ id: a.id, name: a.name }))}
        players={players.map((p) => ({ id: p.id, name: p.name }))}
        isAdmin={user?.role === "admin"}
      />
    </div>
  );
}
