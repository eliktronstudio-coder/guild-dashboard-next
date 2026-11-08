import { prisma } from "@/lib/prisma";
import { ledgerFilters } from "@/lib/ledger-filters";
import { positivePage, value, type ReportParams } from "@/lib/report-filters";
import Pagination from "@/components/reports/Pagination";
import { requireGuildMember } from "@/lib/access";
import StatCard from "@/components/StatCard";
import TreasuryChart from "@/components/charts/TreasuryChart";
import TreasuryPanel from "@/components/admin/TreasuryPanel";
import InventoryPanel from "@/components/admin/InventoryPanel";
import DropsPanel from "@/components/admin/DropsPanel";
import BlurGate from "@/components/BlurGate";
import { getCurrentUser } from "@/lib/auth";
import { isFullAdminRole } from "@/lib/accountRoles";
import { daysUntilNextPayout } from "@/lib/payout";
import {
  getTreasuryTransactions,
  getTreasuryBreakdown,
  getTreasuryChartData,
  getAllDrops,
  getInventory,
  getAllActivities,
  getRegisteredPlayers,
  getAllPlayers,
  getDropCatalog,
  getDropGoldGeneralAuto,
  getDropGoldPrimeManual,
  getDropGoldMiniRb,
} from "@/lib/queries";

const numberFmt = new Intl.NumberFormat("ru-RU");
const dateFmt = new Intl.DateTimeFormat("ru-RU", {
  day: "numeric",
  month: "long",
});

export default async function TreasuryPage({
  searchParams,
}: {
  searchParams: Promise<ReportParams>;
}) {
  const viewer = await requireGuildMember();
  const params = await searchParams;
  const ledger = ledgerFilters(params, isFullAdminRole(viewer.role));
  const totalTransactions = await prisma.treasuryTransaction.count({
    where: ledger.where,
  });
  const transactionPages = Math.max(1, Math.ceil(totalTransactions / 25));
  const transactionPage = positivePage(value(params.page), transactionPages);
  const exportQuery = new URLSearchParams();
  for (const [key, item] of Object.entries(params))
    if (value(item)) exportQuery.set(key, value(item));
  const [
    user,
    transactions,
    treasuryBreakdown,
    treasuryChart,
    drops,
    inventory,
    activities,
    players,
    allPlayers,
    catalog,
    dropGoldGeneralAuto,
    dropGoldPrimeManual,
    dropGoldMiniRb,
  ] = await Promise.all([
    getCurrentUser(),
    getTreasuryTransactions(25, {
      where: ledger.where,
      skip: (transactionPage - 1) * 25,
    }),
    getTreasuryBreakdown(),
    getTreasuryChartData(),
    getAllDrops(50),
    getInventory(),
    getAllActivities(),
    getRegisteredPlayers(),
    getAllPlayers(),
    getDropCatalog(),
    getDropGoldGeneralAuto(),
    getDropGoldPrimeManual(),
    getDropGoldMiniRb(),
  ]);

  // Продажа идёт только со склада ХД — см. решение при переходе на 3 склада.
  const unsoldDropOptions = inventory.hd.map((i) => ({
    item: i.item,
    quantity: i.quantity,
    totalValue: i.totalValue,
    entries: i.entries.map((e) => ({
      id: e.id,
      quantity: e.quantity,
      value: e.value,
    })),
  }));

  const payoutDays = daysUntilNextPayout();
  const isAdmin = isFullAdminRole(user?.role);
  const isRandom = user?.role === "random";

  return (
    <BlurGate blurred={isRandom}>
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
            label="Дроп с Мини-РБ / Дроп с Прайм"
            value={`${numberFmt.format(dropGoldMiniRb)} / ${numberFmt.format(dropGoldPrimeManual)} золота`}
            hint="склад ХД / ручной дроп"
          />
          <StatCard
            label="Дроп общего инвентаря"
            value={`${numberFmt.format(dropGoldGeneralAuto)} золота`}
            hint="суммарно из журнала"
          />
          <StatCard
            label="Дней до выплаты"
            value={`${payoutDays}`}
            hint="выплата 15-го числа"
          />
        </div>

        <div className="min-w-0 rounded-lg border border-border bg-surface p-4">
          <div className="mb-2 flex items-baseline justify-between">
            <h2 className="text-sm font-semibold">Динамика казны</h2>
            <span className="text-xs text-muted">золото</span>
          </div>
          <TreasuryChart data={treasuryChart} />
        </div>

        <div className="min-w-0">
          <InventoryPanel
            title="Общий Инвентарь"
            items={inventory.general}
            activities={activities.map((a) => ({ id: a.id, name: a.name }))}
            players={players.map((p) => ({ id: p.id, name: p.name }))}
            catalog={catalog.map((c) => ({
              id: c.id,
              name: c.name,
              price: c.price,
            }))}
            isAdmin={isAdmin}
            showAddButton
            transferTargets={[
              { value: "ХД", label: "Инвентарь ХД" },
              { value: "НТ", label: "Инвентарь НТ" },
            ]}
          />
        </div>

        <section
          id="ledger"
          className="space-y-3 rounded-xl border border-border bg-surface p-4"
        >
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 className="font-semibold">
              Фильтры журнала · {totalTransactions} операций
            </h2>
            <a
              href={"/api/treasury/export?" + exportQuery}
              className="min-h-11 rounded-lg border border-accent/40 px-4 py-3 text-sm text-accent"
            >
              Экспорт журнала CSV
            </a>
          </div>
          <form
            method="get"
            className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5"
          >
            <label className="text-xs text-muted">
              Описание
              <input
                name="ledgerQuery"
                defaultValue={value(params.ledgerQuery)}
                maxLength={100}
                className="mt-1 min-h-11 w-full rounded-lg border border-border bg-background px-3"
              />
            </label>
            <label className="text-xs text-muted">
              С даты
              <input
                type="date"
                name="ledgerFrom"
                defaultValue={value(params.ledgerFrom)}
                className="mt-1 min-h-11 w-full rounded-lg border border-border bg-background px-3"
              />
            </label>
            <label className="text-xs text-muted">
              По дату
              <input
                type="date"
                name="ledgerTo"
                defaultValue={value(params.ledgerTo)}
                className="mt-1 min-h-11 w-full rounded-lg border border-border bg-background px-3"
              />
            </label>
            <label className="text-xs text-muted">
              Тип операции
              <select
                name="ledgerDirection"
                defaultValue={value(params.ledgerDirection)}
                className="mt-1 min-h-11 w-full rounded-lg border border-border bg-background px-3"
              >
                <option value="">Все операции</option>
                <option value="income">Поступления</option>
                <option value="expense">Расходы</option>
              </select>
            </label>
            <button className="min-h-11 self-end rounded-lg border border-accent/40 px-4 text-sm text-accent">
              Применить к журналу
            </button>
          </form>
          {ledger.error && (
            <p role="alert" className="text-sm text-danger">
              {ledger.error}
            </p>
          )}
          <p className="text-xs text-muted">
            Фильтры влияют на журнал операций; карточки казны показывают текущий
            баланс. Персональные выплаты доступны в разделе «Выплаты».
          </p>
          <Pagination
            page={transactionPage}
            pages={transactionPages}
            params={params}
          />
        </section>

        <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
          <div className="min-w-0">
            <InventoryPanel
              title="Инвентарь ХД"
              items={inventory.hd}
              activities={activities.map((a) => ({ id: a.id, name: a.name }))}
              players={players.map((p) => ({ id: p.id, name: p.name }))}
              catalog={catalog.map((c) => ({
                id: c.id,
                name: c.name,
                price: c.price,
              }))}
              isAdmin={isAdmin}
              showAddButton
              addWarehouse="ХД"
              addCategoryPicker
            />
          </div>

          <div className="min-w-0">
            <InventoryPanel
              title="Инвентарь НТ"
              items={inventory.nt}
              activities={activities.map((a) => ({ id: a.id, name: a.name }))}
              players={players.map((p) => ({ id: p.id, name: p.name }))}
              catalog={catalog.map((c) => ({
                id: c.id,
                name: c.name,
                price: c.price,
              }))}
              isAdmin={isAdmin}
            />
          </div>

          <div className="min-w-0">
            <TreasuryPanel
              transactions={transactions
                .filter((t) => isAdmin || t.kind !== "payout")
                .map((t) => ({ ...t, date: dateFmt.format(t.date) }))}
              drops={unsoldDropOptions}
              players={allPlayers.map((p) => ({ id: p.id, name: p.name }))}
              isAdmin={isAdmin}
            />
          </div>
        </div>

        <DropsPanel
          drops={drops.map((d) => ({
            id: d.id,
            item: d.item,
            value: d.value,
            quantity: d.quantity,
            date: dateFmt.format(d.date),
            activityName: d.activity?.name ?? null,
            playerName: d.player?.name ?? null,
            imageUrl: d.catalogItem?.imageUrl ?? null,
          }))}
          activities={activities.map((a) => ({ id: a.id, name: a.name }))}
          players={players.map((p) => ({ id: p.id, name: p.name }))}
          catalog={catalog.map((c) => ({
            id: c.id,
            name: c.name,
            price: c.price,
            imageUrl: c.imageUrl,
          }))}
          isAdmin={isAdmin}
        />
      </div>
    </BlurGate>
  );
}
