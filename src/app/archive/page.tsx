import Link from "next/link";
import { redirect } from "next/navigation";
import EmptyState from "@/components/EmptyState";
import CreateArchiveButton from "@/components/admin/CreateArchiveButton";
import DeleteArchiveButton from "@/components/admin/DeleteArchiveButton";
import { getArchives } from "@/lib/queries";
import { getCurrentUser } from "@/lib/auth";
import { isFullAdminRole } from "@/lib/accountRoles";

const numberFmt = new Intl.NumberFormat("ru-RU");
const dateFmt = new Intl.DateTimeFormat("ru-RU", { day: "2-digit", month: "2-digit", year: "numeric" });

export default async function ArchivePage() {
  const user = await getCurrentUser();
  if (!isFullAdminRole(user?.role)) redirect("/treasury");

  const archives = await getArchives();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-lg font-semibold">Архив</h1>
        <p className="mt-0.5 text-sm text-muted">
          Архивация за выбранный диапазон дат переносит активности и операции казны в архив и обнуляет живой баланс —
          он начинает считаться заново с 0. Ничего не удаляется, историю можно посмотреть здесь.
        </p>
      </div>

      <CreateArchiveButton />

      {archives.length === 0 ? (
        <EmptyState title="Архив пуст" hint="Здесь появятся архивированные периоды после первой архивации." />
      ) : (
        <div className="overflow-x-auto rounded-lg border border-border bg-surface">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border text-left text-xs uppercase tracking-wider text-muted">
                <th className="px-4 py-3 font-medium">Период</th>
                <th className="px-4 py-3 font-medium">Активностей</th>
                <th className="px-4 py-3 font-medium">Состав</th>
                <th className="px-4 py-3 font-medium">Операций казны</th>
                <th className="px-4 py-3 font-medium">Сумма казны</th>
                <th className="px-4 py-3 font-medium">Архивировано</th>
                <th className="px-4 py-3 font-medium" />
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {archives.map((a) => (
                <tr key={a.id} className="row-tint transition-colors">
                  <td className="px-4 py-3">
                    <Link href={`/archive/${a.id}`} className="font-medium text-accent hover:underline">
                      {a.label}
                    </Link>
                  </td>
                  <td className="px-4 py-3 font-mono tabular-nums text-muted">{a.activityCount}</td>
                  <td className="px-4 py-3 font-mono tabular-nums text-muted">{a.playerCount || "—"}</td>
                  <td className="px-4 py-3 font-mono tabular-nums text-muted">{a.transactionCount}</td>
                  <td className="px-4 py-3 font-mono tabular-nums">{numberFmt.format(a.treasuryTotal)}</td>
                  <td className="px-4 py-3 text-xs text-muted">
                    {dateFmt.format(a.createdAt)}
                    {a.createdBy ? ` · ${a.createdBy}` : ""}
                  </td>
                  <td className="px-4 py-3">
                    <DeleteArchiveButton id={a.id} label={a.label} />
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
