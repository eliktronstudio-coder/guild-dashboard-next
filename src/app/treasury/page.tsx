import StatCard from "@/components/StatCard";
import TreasuryChart from "@/components/charts/TreasuryChart";
import { stats, treasuryHistory } from "@/lib/mock-data";

const numberFmt = new Intl.NumberFormat("ru-RU");

const transactions = [
  { id: 1, description: "Выплата за АГЛ", amount: -24500, date: "14 августа" },
  { id: 2, description: "Продажа лута с аукциона", amount: 18500, date: "13 августа" },
  { id: 3, description: "Взнос на ремонт снаряжения", amount: -9600, date: "12 августа" },
  { id: 4, description: "Дроп с Разъяренного Морфеоса", amount: 27300, date: "11 августа" },
];

export default function TreasuryPage() {
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <StatCard
          label="Золото в казне"
          value={`${numberFmt.format(stats.treasuryGold)} золота`}
          hint="—"
        />
        <StatCard
          label="Дроп с РБ"
          value={`${numberFmt.format(stats.raidDropGoldEquivalent)} золота`}
          hint="эквивалент в золоте"
        />
        <StatCard
          label="Дней до выплаты"
          value={`${stats.daysUntilPayout}`}
          hint="до дня выплат"
        />
      </div>

      <div className="rounded-lg border border-border bg-surface p-4">
        <h2 className="mb-2 text-sm font-semibold">Динамика казны</h2>
        <TreasuryChart data={treasuryHistory} />
      </div>

      <div className="rounded-lg border border-border bg-surface">
        <div className="border-b border-border p-4">
          <h2 className="text-sm font-semibold">Последние операции</h2>
        </div>
        <ul className="divide-y divide-border">
          {transactions.map((t) => (
            <li key={t.id} className="flex items-center justify-between px-4 py-3 text-sm">
              <span>{t.description}</span>
              <span className="flex items-center gap-3">
                <span className={t.amount >= 0 ? "text-success" : "text-danger"}>
                  {t.amount >= 0 ? "+" : ""}
                  {numberFmt.format(t.amount)}
                </span>
                <span className="text-xs text-muted">{t.date}</span>
              </span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
