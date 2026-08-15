import StatCard from "@/components/StatCard";
import TreasuryPanel from "@/components/admin/TreasuryPanel";
import InventoryPanel from "@/components/admin/InventoryPanel";
import DropsPanel from "@/components/admin/DropsPanel";
import { getCurrentUser } from "@/lib/auth";
import { daysUntilNextPayout } from "@/lib/payout";
import {
  getTreasuryTransactions,
  getTreasuryBreakdown,
  getAllDrops,
  getDropGoldTotal,
  getInventory,
  getAllActivities,
  getRegisteredPlayers,
  getDropCatalog,
} from "@/lib/queries";

const numberFmt = new Intl.NumberFormat("ru-RU");
const dateFmt = new Intl.DateTimeFormat("ru-RU", { day: "numeric", month: "long" });

export default async function TreasuryPage() {
  const [user, transactions, treasuryBreakdown, drops, dropTotal, inventory, activities, players, catalog] =
    await Promise.all([
      getCurrentUser(),
      getTreasuryTransactions(20),
      getTreasuryBreakdown(),
      getAllDrops(50),
      getDropGoldTotal(),
      getInventory(),
      getAllActivities(),
      getRegisteredPlayers(),
      getDropCatalog(),
    ]);

  const payoutDays = daysUntilNextPayout();
  const isAdmin = user?.role === "admin";

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
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
        <StatCard label="Дроп с РБ" value={`${numberFmt.format(dropTotal)} золота`} hint="суммарно из журнала" />
        <StatCard label="Дней до выплаты" value={`${payoutDays}`} hint="выплата 15-го числа" />
      </div>

      <InventoryPanel items={inventory} />

      <TreasuryPanel
        transactions={transactions.map((t) => ({ ...t, date: dateFmt.format(t.date) }))}
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
