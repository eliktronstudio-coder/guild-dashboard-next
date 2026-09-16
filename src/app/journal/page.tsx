import { redirect } from "next/navigation";
import EmptyState from "@/components/EmptyState";
import { getTreasuryTransactions, getAllPeriodsForFilter } from "@/lib/queries";
import { getCurrentUser } from "@/lib/auth";
import { isFullAdminRole } from "@/lib/accountRoles";

const numberFmt = new Intl.NumberFormat("ru-RU");
const dateFmt = new Intl.DateTimeFormat("ru-RU", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" });

function operationType(kind: string | null, amount: number): string {
  if (kind === "payout") return amount < 0 ? "Выплата игроку" : "Отмена выплаты";
  return amount >= 0 ? "Приход" : "Расход";
}

export default async function JournalPage({ searchParams }: { searchParams: Promise<{ period?: string }> }) {
  const user = await getCurrentUser();
  if (!isFullAdminRole(user?.role)) redirect("/payments");

  const { period: periodFilter } = await searchParams;
  const [periods, transactions] = await Promise.all([
    getAllPeriodsForFilter(),
    getTreasuryTransactions(500, periodFilter || undefined),
  ]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-lg font-semibold">Финансовый журнал</h1>
        <p className="mt-0.5 text-sm text-muted">Все операции движения золота, по одной строке на операцию.</p>
      </div>

      <form className="flex flex-wrap items-center gap-2 text-sm">
        <label className="text-muted" htmlFor="period">
          Период:
        </label>
        <select
          id="period"
          name="period"
          defaultValue={periodFilter ?? ""}
          className="rounded-md border border-border bg-surface px-2 py-1.5"
        >
          <option value="">Все периоды</option>
          {periods.map((p) => (
            <option key={p.id} value={p.id}>
              {p.label} {p.status === "active" ? "(активный)" : "(закрыт)"}
            </option>
          ))}
        </select>
        <button type="submit" className="rounded-md border border-border bg-surface px-3 py-1.5 hover:bg-surface-2">
          Применить
        </button>
      </form>

      {transactions.length === 0 ? (
        <EmptyState title="Операций не найдено" hint="Попробуйте выбрать другой период." />
      ) : (
        <div className="overflow-x-auto rounded-lg border border-border bg-surface">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border text-left text-xs uppercase tracking-wider text-muted">
                <th className="px-4 py-3 font-medium">Дата</th>
                <th className="px-4 py-3 font-medium">Описание</th>
                <th className="px-4 py-3 font-medium">Тип</th>
                <th className="px-4 py-3 font-medium">Казна</th>
                <th className="px-4 py-3 font-medium">Сумма</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {transactions.map((t) => (
                <tr key={t.id} className="row-tint transition-colors">
                  <td className="px-4 py-3 text-muted">{dateFmt.format(t.date)}</td>
                  <td className="px-4 py-3">{t.description}</td>
                  <td className="px-4 py-3 text-muted">{operationType(t.kind, t.amount)}</td>
                  <td className="px-4 py-3 text-muted">{t.category ?? "—"}</td>
                  <td className={`px-4 py-3 font-mono tabular-nums ${t.amount >= 0 ? "text-success" : "text-danger"}`}>
                    {t.amount >= 0 ? "+" : ""}
                    {numberFmt.format(t.amount)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
