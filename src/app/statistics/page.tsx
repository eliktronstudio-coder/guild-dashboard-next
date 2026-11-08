import Link from "next/link";
import { requireGuildMember } from "@/lib/access";
import { getStatistics } from "@/lib/statistics";
import { value, type ReportParams } from "@/lib/report-filters";
import ReportFilters from "@/components/reports/ReportFilters";
import AnalyticsChart from "@/components/reports/AnalyticsChart";
import Pagination from "@/components/reports/Pagination";
import StatCard from "@/components/StatCard";
import EmptyState from "@/components/EmptyState";
const format = new Intl.NumberFormat("ru-RU");
export default async function StatisticsPage({
  searchParams,
}: {
  searchParams: Promise<ReportParams>;
}) {
  const user = await requireGuildMember();
  const params = await searchParams;
  const report = await getStatistics(params, user);
  const query = new URLSearchParams();
  for (const [key, val] of Object.entries(params))
    if (value(val)) query.set(key, value(val));
  return (
    <div className="space-y-5">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-xs uppercase tracking-widest text-accent">
            XD · Аналитический центр
          </p>
          <h1 className="mt-2 font-heading text-2xl">Статистика гильдии</h1>
          <p className="mt-2 text-sm text-muted">
            {report.from.toLocaleDateString("ru-RU")} —{" "}
            {new Date(report.to.getTime() - 1).toLocaleDateString("ru-RU")} ·{" "}
            {report.archive ? "Архивный снимок" : "Фактические участия"}
          </p>
        </div>
        <a
          className="min-h-11 rounded-lg border border-accent/40 px-4 py-3 text-sm text-accent"
          href={"/api/statistics/export?" + query}
        >
          Скачать CSV
        </a>
      </header>
      <nav
        className="flex flex-wrap gap-3 text-sm"
        aria-label="Аналитические вкладки"
      >
        <Link
          className="min-h-11 rounded-lg border border-border px-4 py-3"
          href="/statistics"
        >
          Общая аналитика
        </Link>
        <Link
          className="min-h-11 rounded-lg border border-border px-4 py-3"
          href="/statistics?category=PvP"
        >
          PvP-аналитика
        </Link>
        <a
          className="min-h-11 rounded-lg border border-border px-4 py-3"
          href="#finance"
        >
          Финансы
        </a>
      </nav>
      <ReportFilters params={params} archives={report.archives} />
      {report.error ? (
        <p
          role="alert"
          className="rounded-lg border border-danger p-4 text-danger"
        >
          {report.error}
        </p>
      ) : (
        <>
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            {[
              ["Участников в составе", report.summary.players],
              ["Уникальных участников", report.summary.unique],
              ["Проведено активностей", report.summary.activities],
              ["Всего участий", report.summary.participations],
              ["Средняя посещаемость", report.summary.average ?? "Нет данных"],
              ["PvP-событий", report.summary.pvpActivities],
              ["Убийства в PvP", report.summary.kills],
              ["Очки чести", report.summary.honor],
              ["PvP-участий", report.summary.pvpParticipations],
              [
                "Подтверждённые победы / поражения",
                `${report.summary.wins} / ${report.summary.defeats}`,
              ],
            ].map(([label, number]) => (
              <StatCard
                hint="за выбранный период"
                key={String(label)}
                label={String(label)}
                value={
                  typeof number === "number"
                    ? format.format(number)
                    : String(number)
                }
              />
            ))}
          </div>
          <div className="grid gap-4 xl:grid-cols-2">
            <AnalyticsChart
              title="Посещаемость по дням"
              data={report.daily}
              series={[
                { key: "prime", label: "Прайм", color: "var(--accent)" },
                { key: "miniRb", label: "Мини-РБ", color: "var(--info)" },
              ]}
            />
            <AnalyticsChart
              title="Посещаемость по неделям"
              data={report.weekly}
              series={[
                { key: "count", label: "Участия", color: "var(--success)" },
              ]}
            />
          </div>
          <section id="finance" className="space-y-3">
            <h2 className="text-lg font-semibold">Финансы за диапазон дат</h2>
            <p className="text-sm text-muted">
              Денежный журнал учитывается по дате операции. Категория
              посещаемости не меняет финансовую категорию продажи.
            </p>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <StatCard
                hint="денежный журнал за диапазон"
                label="Поступления Прайма"
                value={format.format(report.finance.primeSales) + " золота"}
              />
              <StatCard
                hint="100% — фонд Мини-РБ"
                label="Поступления Мини-РБ"
                value={format.format(report.finance.miniRbSales) + " золота"}
              />
              <StatCard
                hint="30% поступлений Прайма"
                label="Доля гильдии"
                value={format.format(report.finance.guildShare) + " золота"}
              />
              <StatCard
                hint="выплаты за вычетом отмен"
                label="Выплачено зарплат"
                value={format.format(report.finance.paid) + " золота"}
              />
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <StatCard
                hint="за выбранный период"
                label="Доходы"
                value={format.format(report.summary.income) + " золота"}
              />
              <StatCard
                hint="за выбранный период"
                label="Расходы"
                value={format.format(report.summary.expense) + " золота"}
              />
            </div>
            <AnalyticsChart
              title="Доходы и расходы"
              data={report.daily}
              series={[
                { key: "income", label: "Доходы", color: "var(--success)" },
                { key: "expense", label: "Расходы", color: "var(--danger)" },
              ]}
            />
          </section>
          <section className="space-y-4">
            <h2 className="text-lg font-semibold">
              Рейтинг участников · {report.total}
            </h2>
            <p className="text-sm text-muted">
              Прайм — взвешенная посещаемость. Начисления доступны за полный
              текущий период или архив. Персональные суммы видят владелец
              профиля и администрация.
            </p>
            {report.rows.length ? (
              <div className="overflow-x-auto rounded-xl border border-border">
                <table className="w-full text-left text-sm">
                  <thead className="bg-surface text-xs text-muted">
                    <tr>
                      {[
                        "Игрок",
                        "Класс",
                        "Посещено / доступно",
                        "Общая",
                        "Прайм",
                        "Мини-РБ",
                        "PvP",
                        "Убийства",
                        "Честь",
                        "Начислено",
                      ].map((label) => (
                        <th
                          scope="col"
                          key={label}
                          className="whitespace-nowrap p-3"
                        >
                          {label}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {report.rows.map((p) => (
                      <tr key={p.id} className="border-t border-border">
                        <th scope="row" className="p-3 font-medium">
                          {p.profileId ? (
                            <Link
                              className="text-accent hover:underline"
                              href={"/players/" + p.profileId}
                            >
                              {p.name}
                            </Link>
                          ) : (
                            p.name
                          )}
                        </th>
                        {[
                          p.role,
                          `${p.attended} / ${p.available}`,
                          `${p.attendance}%`,
                          `${p.prime}%`,
                          `${p.miniRb}%`,
                          p.pvp,
                          p.kills,
                          p.honor,
                          p.salary === null ? "—" : format.format(p.salary),
                        ].map((val, i) => (
                          <td
                            key={i}
                            className="whitespace-nowrap p-3 tabular-nums"
                          >
                            {val}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <EmptyState title="Нет участников по выбранным фильтрам" />
            )}
            <Pagination
              page={report.page}
              pages={report.totalPages}
              params={params}
            />
          </section>
        </>
      )}
    </div>
  );
}
