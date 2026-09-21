import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import EmptyState from "@/components/EmptyState";
import AttendanceBar from "@/components/AttendanceBar";
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

  const attendedCount = archive.playerStats.filter((p) => p.attended > 0).length;

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

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <div className="rounded-lg border border-border bg-surface p-4">
          <p className="text-xs text-muted">Казна Прайм</p>
          <p className="mt-1 text-xl font-semibold">{numberFmt.format(archive.treasuryPrime)}</p>
          <p className="mt-0.5 text-xs text-muted">фонд ЗП, 70% с продаж</p>
        </div>
        <div className="rounded-lg border border-border bg-surface p-4">
          <p className="text-xs text-muted">Казна Мини-РБ</p>
          <p className="mt-1 text-xl font-semibold">{numberFmt.format(archive.treasuryMiniRb)}</p>
          <p className="mt-0.5 text-xs text-muted">целиком на выплату</p>
        </div>
        <div className="rounded-lg border border-border bg-surface p-4">
          <p className="text-xs text-muted">Казна гильдии</p>
          <p className="mt-1 text-xl font-semibold">{numberFmt.format(archive.treasuryGuild)}</p>
          <p className="mt-0.5 text-xs text-muted">резерв, 30% с Прайма</p>
        </div>
        <div className="rounded-lg border border-border bg-surface p-4">
          <p className="text-xs text-muted">Всего в казне</p>
          <p className="mt-1 text-xl font-semibold">{numberFmt.format(archive.treasuryTotal)}</p>
          <p className="mt-0.5 text-xs text-muted">{archive.transactions.length} операций</p>
        </div>
      </div>

      {/* ——— Состав на момент архивации ——— */}
      <div>
        <div className="mb-2 flex flex-wrap items-baseline justify-between gap-2">
          <h2 className="text-sm font-semibold">Состав ({archive.playerStats.length})</h2>
          <p className="text-xs text-muted">
            Снимок на момент архивации · ходили {attendedCount} из {archive.playerStats.length}
          </p>
        </div>

        {archive.playerStats.length === 0 ? (
          <EmptyState
            title="Состав не сохранён"
            hint="Этот архив создан до появления снимка состава — проценты за тот период восстановить нельзя."
          />
        ) : (
          <div className="overflow-x-auto rounded-lg border border-border bg-surface">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border text-left text-xs uppercase tracking-wider text-muted">
                  <th className="px-4 py-3 font-medium">Игрок</th>
                  <th className="px-4 py-3 font-medium">Роль</th>
                  <th className="px-4 py-3 font-medium">Всего</th>
                  <th className="px-4 py-3 font-medium">Прайм</th>
                  <th className="px-4 py-3 font-medium">Мини-РБ</th>
                  <th className="px-4 py-3 font-medium">Был на</th>
                  <th className="px-4 py-3 font-medium">PvP</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {archive.playerStats.map((p) => (
                  <tr key={p.id} className="row-tint transition-colors">
                    <td className="px-4 py-3 font-medium">
                      {p.playerId ? (
                        <Link href={`/players/${p.playerId}`} className="text-accent hover:underline">
                          {p.playerName}
                        </Link>
                      ) : (
                        <span title="Игрок удалён из состава после архивации">
                          {p.playerName}
                          <span className="ml-1.5 text-xs text-muted">(удалён)</span>
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-muted">{p.role}</td>
                    <td className="px-4 py-3">
                      <AttendanceBar pct={p.attendancePct} />
                    </td>
                    <td className="px-4 py-3">
                      <AttendanceBar pct={p.attendancePctPrime} />
                    </td>
                    <td className="px-4 py-3">
                      <AttendanceBar pct={p.attendancePctMiniRb} />
                    </td>
                    <td className="px-4 py-3 font-mono text-xs tabular-nums text-muted">
                      {p.attended} из {p.activitiesTotal}
                    </td>
                    <td className="px-4 py-3 font-mono tabular-nums text-muted">{p.pvpCount || "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ——— Активности: каждую можно открыть ——— */}
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
                  <th className="px-4 py-3 font-medium">Сложность</th>
                  <th className="px-4 py-3 font-medium">Дата</th>
                  <th className="px-4 py-3 font-medium">Состав</th>
                  <th className="px-4 py-3 font-medium">Дроп</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {archive.activities.map((a) => (
                  <tr key={a.id} className="row-tint transition-colors">
                    <td className="px-4 py-3 font-medium">
                      <Link href={`/activities/${a.id}`} className="text-accent hover:underline">
                        {a.name}
                      </Link>
                      {a.isNight ? <span className="ml-1.5 text-xs text-muted">ночная</span> : null}
                    </td>
                    <td className="px-4 py-3 text-muted">{a.category}</td>
                    <td className="px-4 py-3 text-muted">{a.mode}</td>
                    <td className="px-4 py-3 text-muted">{a.difficulty}</td>
                    <td className="px-4 py-3 text-muted">{a.date}</td>
                    <td className="px-4 py-3 font-mono tabular-nums text-muted">
                      {a.participants}
                      {a.guests > 0 ? <span className="text-xs"> +{a.guests} гост.</span> : null}
                    </td>
                    <td className="px-4 py-3 font-mono tabular-nums text-muted">
                      {a.dropCount > 0 ? `${numberFmt.format(a.dropTotal)} (${a.dropCount})` : "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ——— Операции казны ——— */}
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
