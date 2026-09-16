import Link from "next/link";
import EmptyState from "@/components/EmptyState";
import { getArchivePeriods } from "@/lib/queries";
import { getCurrentUser } from "@/lib/auth";
import { isFullAdminRole } from "@/lib/accountRoles";
import { redirect } from "next/navigation";

const numberFmt = new Intl.NumberFormat("ru-RU");

export default async function ArchivePage() {
  const user = await getCurrentUser();
  if (!isFullAdminRole(user?.role)) redirect("/payments");

  const periods = await getArchivePeriods();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-lg font-semibold">Архив расчётных периодов</h1>
        <p className="mt-0.5 text-sm text-muted">
          Закрытые периоды доступны только для просмотра и погашения задолженности — активности, продажи и
          начисления внутри них больше не меняются.
        </p>
      </div>

      {periods.length === 0 ? (
        <EmptyState title="Архив пуст" hint="Здесь появятся периоды после первой архивации на странице «Выплата»." />
      ) : (
        <div className="overflow-x-auto rounded-lg border border-border bg-surface">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border text-left text-xs uppercase tracking-wider text-muted">
                <th className="px-4 py-3 font-medium">Период</th>
                <th className="px-4 py-3 font-medium">Игроков</th>
                <th className="px-4 py-3 font-medium">Начислено</th>
                <th className="px-4 py-3 font-medium">Выплачено</th>
                <th className="px-4 py-3 font-medium">Остаток</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {periods.map((p) => (
                <tr key={p.id} className="row-tint transition-colors">
                  <td className="px-4 py-3">
                    <Link href={`/archive/${p.id}`} className="font-medium text-accent hover:underline">
                      {p.label}
                    </Link>
                  </td>
                  <td className="px-4 py-3 font-mono tabular-nums text-muted">{p.playerCount}</td>
                  <td className="px-4 py-3 font-mono tabular-nums">{numberFmt.format(p.accrued)}</td>
                  <td className="px-4 py-3 font-mono tabular-nums text-success">{numberFmt.format(p.paid)}</td>
                  <td className={`px-4 py-3 font-mono tabular-nums ${p.debt > 0 ? "text-danger" : "text-muted"}`}>
                    {numberFmt.format(p.debt)}
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
