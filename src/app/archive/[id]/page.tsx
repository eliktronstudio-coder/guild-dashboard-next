import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import EmptyState from "@/components/EmptyState";
import ArchivePayButton from "@/components/admin/ArchivePayButton";
import { getArchivePeriodDetail } from "@/lib/queries";
import { getCurrentUser } from "@/lib/auth";
import { isFullAdminRole } from "@/lib/accountRoles";

const numberFmt = new Intl.NumberFormat("ru-RU");
const dateFmt = new Intl.DateTimeFormat("ru-RU", { day: "numeric", month: "long", year: "numeric" });

export default async function ArchivePeriodPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (!isFullAdminRole(user?.role)) redirect("/payments");

  const { id } = await params;
  const period = await getArchivePeriodDetail(id);
  if (!period) notFound();

  const totalAccrued = period.players.reduce((s, p) => s + p.accruedPrime + p.accruedMiniRb, 0);
  const totalPaid = period.players.reduce((s, p) => s + p.paidPrime + p.paidMiniRb, 0);

  return (
    <div className="space-y-6">
      <div>
        <Link href="/archive" className="text-xs text-muted hover:underline">
          ← Архив периодов
        </Link>
        <h1 className="mt-1 text-lg font-semibold">{period.label}</h1>
        <p className="mt-0.5 text-sm text-muted">
          Закрыт {period.closedAt ? dateFmt.format(period.closedAt) : "—"}
          {period.closedBy ? ` · ${period.closedBy}` : ""} · начислено {numberFmt.format(totalAccrued)}, выплачено{" "}
          {numberFmt.format(totalPaid)}, долг {numberFmt.format(totalAccrued - totalPaid)}
        </p>
      </div>

      {period.players.length === 0 ? (
        <EmptyState title="В этом периоде некому было платить" />
      ) : (
        <div className="overflow-x-auto rounded-lg border border-border bg-surface">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border text-left text-xs uppercase tracking-wider text-muted">
                <th className="px-4 py-3 font-medium">Игрок</th>
                <th className="px-4 py-3 font-medium">Прайм (нач./ост.)</th>
                <th className="px-4 py-3 font-medium"></th>
                <th className="px-4 py-3 font-medium">Мини-РБ (нач./ост.)</th>
                <th className="px-4 py-3 font-medium"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {period.players.map((p) => (
                <tr key={p.playerId} className="row-tint transition-colors">
                  <td className="px-4 py-3 font-medium">{p.playerName}</td>
                  <td className="px-4 py-3 font-mono tabular-nums">
                    {numberFmt.format(p.accruedPrime)} / {numberFmt.format(p.remainingPrime)}
                  </td>
                  <td className="px-4 py-3">
                    <ArchivePayButton
                      periodId={period.id}
                      playerId={p.playerId}
                      category="Прайм"
                      remaining={p.remainingPrime}
                    />
                  </td>
                  <td className="px-4 py-3 font-mono tabular-nums">
                    {numberFmt.format(p.accruedMiniRb)} / {numberFmt.format(p.remainingMiniRb)}
                  </td>
                  <td className="px-4 py-3">
                    <ArchivePayButton
                      periodId={period.id}
                      playerId={p.playerId}
                      category="Мини-РБ"
                      remaining={p.remainingMiniRb}
                    />
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
