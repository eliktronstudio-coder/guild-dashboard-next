import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import EmptyState from "@/components/EmptyState";
import { getArchiveDetail } from "@/lib/queries";
import { getCurrentUser } from "@/lib/auth";
import { isFullAdminRole } from "@/lib/accountRoles";

const numberFmt = new Intl.NumberFormat("ru-RU");
const dateFmt = new Intl.DateTimeFormat("ru-RU", { day: "2-digit", month: "2-digit", year: "numeric" });

export default async function ArchiveDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (!isFullAdminRole(user?.role)) redirect("/treasury");

  const { id } = await params;
  const archive = await getArchiveDetail(id);
  if (!archive) notFound();

  return (
    <div className="space-y-6">
      <div>
        <Link href="/archive" className="text-xs text-muted hover:underline">
          ← Архив
        </Link>
        <h1 className="mt-1 text-lg font-semibold">{archive.label}</h1>
        <p className="mt-0.5 text-sm text-muted">
          Архивировано {dateFmt.format(archive.createdAt)}
          {archive.createdBy ? ` · ${archive.createdBy}` : ""}
        </p>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <div className="rounded-lg border border-border bg-surface p-4">
          <p className="text-xs text-muted">Казна Прайм (в архиве)</p>
          <p className="mt-1 text-xl font-semibold">{numberFmt.format(archive.treasuryPrime)}</p>
        </div>
        <div className="rounded-lg border border-border bg-surface p-4">
          <p className="text-xs text-muted">Казна Мини-РБ (в архиве)</p>
          <p className="mt-1 text-xl font-semibold">{numberFmt.format(archive.treasuryMiniRb)}</p>
        </div>
        <div className="rounded-lg border border-border bg-surface p-4">
          <p className="text-xs text-muted">Всего операций казны</p>
          <p className="mt-1 text-xl font-semibold">{numberFmt.format(archive.treasuryTotal)}</p>
        </div>
      </div>

      <div>
        <h2 className="mb-2 text-sm font-semibold">Активности ({archive.activities.length})</h2>
        {archive.activities.length === 0 ? (
          <EmptyState title="В этом архиве нет активностей" />
        ) : (
          <div className="overflow-x-auto rounded-lg border border-border bg-surface">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border text-left text-xs uppercase tracking-wider text-muted">
                  <th className="px-4 py-3 font-medium">Название</th>
                  <th className="px-4 py-3 font-medium">Категория</th>
                  <th className="px-4 py-3 font-medium">Режим</th>
                  <th className="px-4 py-3 font-medium">Дата</th>
                  <th className="px-4 py-3 font-medium">Участников</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {archive.activities.map((a) => (
                  <tr key={a.id} className="row-tint transition-colors">
                    <td className="px-4 py-3 font-medium">{a.name}</td>
                    <td className="px-4 py-3 text-muted">{a.category}</td>
                    <td className="px-4 py-3 text-muted">{a.mode}</td>
                    <td className="px-4 py-3 text-muted">{a.date}</td>
                    <td className="px-4 py-3 font-mono tabular-nums text-muted">{a.participants}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div>
        <h2 className="mb-2 text-sm font-semibold">Операции казны ({archive.transactions.length})</h2>
        {archive.transactions.length === 0 ? (
          <EmptyState title="В этом архиве нет операций казны" />
        ) : (
          <div className="overflow-x-auto rounded-lg border border-border bg-surface">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border text-left text-xs uppercase tracking-wider text-muted">
                  <th className="px-4 py-3 font-medium">Описание</th>
                  <th className="px-4 py-3 font-medium">Казна</th>
                  <th className="px-4 py-3 font-medium">Дата</th>
                  <th className="px-4 py-3 font-medium">Сумма</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {archive.transactions.map((t) => (
                  <tr key={t.id} className="row-tint transition-colors">
                    <td className="px-4 py-3">{t.description}</td>
                    <td className="px-4 py-3 text-muted">{t.category ?? "—"}</td>
                    <td className="px-4 py-3 text-muted">{dateFmt.format(t.date)}</td>
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
    </div>
  );
}
