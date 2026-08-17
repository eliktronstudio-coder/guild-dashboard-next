import StatCard from "@/components/StatCard";
import TreasuryChart from "@/components/charts/TreasuryChart";
import TreasuryPanel from "@/components/admin/TreasuryPanel";
import InventoryPanel from "@/components/admin/InventoryPanel";
import DropsPanel from "@/components/admin/DropsPanel";
import { getCurrentUser } from "@/lib/auth";
import { daysUntilNextPayout } from "@/lib/payout";
import {
  getTreasuryTransactions,
  getTreasuryBreakdown,
  getTreasuryChartData,
  getAllDrops,
  getDropGoldTotalByCategory,
  getInventory,
  getAllActivities,
  getRegisteredPlayers,
  getAllPlayers,
  getDropCatalog,
} from "@/lib/queries";

const numberFmt = new Intl.NumberFormat("ru-RU");
const dateFmt = new Intl.DateTimeFormat("ru-RU", { day: "numeric", month: "long" });

export default async function TreasuryPage() {
  const [
    user,
    transactions,
    treasuryBreakdown,
    treasuryChart,
    drops,
    dropTotalMiniRb,
    dropTotalPrime,
    inventory,
    activities,
    players,
    allPlayers,
    catalog,
  ] = await Promise.all([
    getCurrentUser(),
    getTreasuryTransactions(20),
    getTreasuryBreakdown(),
    getTreasuryChartData(),
    getAllDrops(50),
    getDropGoldTotalByCategory("Мини-РБ"),
    getDropGoldTotalByCategory("Прайм"),
    getInventory(),
    getAllActivities(),
    getRegisteredPlayers(),
    getAllPlayers(),
    getDropCatalog(),
  ]);

  const unsoldDropOptions = inventory.flatMap((i) =>
    i.entries.map((e) => ({ id: e.id, item: i.item, quantity: e.quantity, value: e.value }))
  );

  const payoutDays = daysUntilNextPayout();
  const isAdmin = user?.role === "admin";

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-6">
        <StatCard
          label="Казна с Прайма"
          value={`${numberFmt.format(treasuryBreakdown.prime)} золота`}
          hint="70% — фонд ЗП"
        />
        <StatCard
          label="Казна мини-РБ"
          value={`${numberFmt.format(treasuryBreakdown.miniRb)} золота`}
          hint="100% — фонд ЗП"
        />
        <StatCard
          label="Казна гильдии"
          value={`${numberFmt.format(treasuryBreakdown.guild)} золота`}
          hint="30% — резерв гильдии"
        />
        <StatCard
          label="Дроп с Мини-РБ"
          value={`${numberFmt.format(dropTotalMiniRb)} золота`}
          hint="суммарно из журнала"
        />
        <StatCard
          label="Дроп с Прайм"
          value={`${numberFmt.format(dropTotalPrime)} золота`}
          hint="суммарно из журнала"
        />
        <StatCard label="Дней до выплаты" value={`${payoutDays}`} hint="выплата 15-го числа" />
      </div>

      <div className="min-w-0 rounded-lg border border-border bg-surface p-4">
        <div className="mb-2 flex items-baseline justify-between">
          <h2 className="text-sm font-semibold">Динамика казны</h2>
          <span className="text-xs text-muted">золото</span>
        </div>
        <TreasuryChart data={treasuryChart} />
      </div>

      <InventoryPanel
        items={inventory}
        activities={activities.map((a) => ({ id: a.id, name: a.name }))}
        players={players.map((p) => ({ id: p.id, name: p.name }))}
        catalog={catalog.map((c) => ({ id: c.id, name: c.name, price: c.price }))}
        isAdmin={isAdmin}
      />

      <TreasuryPanel
        transactions={transactions.map((t) => ({ ...t, date: dateFmt.format(t.date) }))}
        drops={unsoldDropOptions}
        players={allPlayers.map((p) => ({ id: p.id, name: p.name }))}
        isAdmin={isAdmin}
      />

      <DropsPanel
        drops={drops.map((d) => ({
          id: d.id,
          item: d.item,
          value: d.value,
          quantity: d.quantity,
          status: d.status,
          date: dateFmt.format(d.date),
          activityName: d.activity?.name ?? null,
          playerName: d.player?.name ?? null,
          imageUrl: d.catalogItem?.imageUrl ?? null,
        }))}
        activities={activities.map((a) => ({ id: a.id, name: a.name }))}
        players={players.map((p) => ({ id: p.id, name: p.name }))}
        catalog={catalog.map((c) => ({ id: c.id, name: c.name, price: c.price, imageUrl: c.imageUrl }))}
        isAdmin={isAdmin}
      />
    </div>
  );
}
