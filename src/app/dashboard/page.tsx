import Link from "next/link";
import clsx from "clsx";
import { Crown, ShieldCheck, TrendingUp, Users, CalendarClock } from "lucide-react";
import StatCard from "@/components/StatCard";
import TreasuryChart from "@/components/charts/TreasuryChart";
import AttendanceChart from "@/components/charts/AttendanceChart";
import EmptyState from "@/components/EmptyState";
import { daysUntilNextPayout } from "@/lib/payout";
import {
  topPlayersByAttendance,
  getAllActivities,
  getTreasuryBreakdown,
  getTreasuryChartData,
  getAttendanceChartData,
  getAvgActivityDays,
  getDropGoldTotal,
} from "@/lib/queries";

const numberFmt = new Intl.NumberFormat("ru-RU");

function attendanceColor(pct: number) {
  if (pct <= 20) return { text: "text-danger", bar: "bg-danger" };
  if (pct <= 50) return { text: "text-amber-500", bar: "bg-amber-500" };
  return { text: "text-success", bar: "bg-success" };
}

export default async function DashboardPage() {
  const [attendanceTop, allActivities, treasuryBreakdown, treasuryChart, attendanceChart, avgActivityDays, dropGoldTotal] =
    await Promise.all([
      topPlayersByAttendance(5),
      getAllActivities(),
      getTreasuryBreakdown(),
      getTreasuryChartData(),
      getAttendanceChartData(),
      getAvgActivityDays(),
      getDropGoldTotal(),
    ]);
  const recentActivities = allActivities.slice(0, 5);
  const payoutDays = daysUntilNextPayout();

  return (
    <div className="space-y-6">
      <div className="relative">
        <div
          aria-hidden="true"
          className="pointer-events-none absolute -inset-x-4 -top-6 -z-10 h-[380px] overflow-hidden sm:-inset-x-6"
        >
          <div
            className="absolute inset-0"
            style={{
              maskImage: "linear-gradient(to bottom, black 55%, transparent 100%)",
              WebkitMaskImage: "linear-gradient(to bottom, black 55%, transparent 100%)",
            }}
          >
            <div
              className="absolute inset-0 bg-cover bg-[position:78%_18%]"
              style={{
                backgroundImage: "url(/images/atmosphere.png)",
                maskImage: "linear-gradient(to left, black 0%, black 42%, transparent 88%)",
                WebkitMaskImage: "linear-gradient(to left, black 0%, black 42%, transparent 88%)",
                opacity: 0.55,
                filter: "saturate(1.05)",
              }}
            />
          </div>
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-5">
          <StatCard
            label="Основная казна"
            value={`${numberFmt.format(treasuryBreakdown.main)} золота`}
            hint="70% — фонд ЗП"
            icon={Crown}
            tone="accent"
          />
          <StatCard
            label="Казна гильдии"
            value={`${numberFmt.format(treasuryBreakdown.guild)} золота`}
            hint="30% — резерв гильдии"
            icon={ShieldCheck}
            tone="violet"
          />
          <StatCard
            label="Дроп с РБ"
            value={`${numberFmt.format(dropGoldTotal)} золота`}
            hint="эквивалент в золоте"
            icon={TrendingUp}
            tone="ember"
          />
          <StatCard
            label="Ср. активность"
            value={avgActivityDays > 0 ? `${avgActivityDays} дней` : "—"}
            hint="между активностями"
            icon={Users}
            tone="info"
          />
          <StatCard
            label="Дней до выплаты"
            value={`${payoutDays}`}
            hint="выплата 15-го числа"
            icon={CalendarClock}
            tone="accent-dim"
          />
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
        <div className="min-w-0 rounded-lg border border-border bg-surface p-4">
          <div className="mb-2 flex items-baseline justify-between">
            <h2 className="text-sm font-semibold">Динамика казны</h2>
            <span className="text-xs text-muted">золото</span>
          </div>
          <TreasuryChart data={treasuryChart} />
        </div>
        <div className="min-w-0 rounded-lg border border-border bg-surface p-4">
          <div className="mb-2 flex items-baseline justify-between">
            <h2 className="text-sm font-semibold">Посещаемость</h2>
            <span className="text-xs text-muted">участия / день</span>
          </div>
          <AttendanceChart data={attendanceChart} />
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
        <div className="rounded-lg border border-border bg-surface p-4">
          <div className="mb-3 flex items-baseline justify-between">
            <h2 className="text-sm font-semibold">Топ по посещаемости</h2>
            <div className="flex items-center gap-3">
              <span className="text-xs text-muted">за всё время</span>
              <Link href="/players" className="text-xs text-accent hover:underline">
                Состав
              </Link>
            </div>
          </div>
          {attendanceTop.length === 0 ? (
            <EmptyState title="Нет данных за выбранный период" />
          ) : (
            <ol className="space-y-1">
              {attendanceTop.map((p, i) => (
                <li key={p.id}>
                  <Link
                    href={`/players/${p.id}`}
                    className="row-tint block rounded-md px-2 py-2 text-sm transition-colors"
                  >
                    <div className="flex items-center justify-between">
                      <span className="flex items-center gap-3">
                        <span className="w-4 text-muted">{i + 1}</span>
                        <span className="font-medium">{p.name}</span>
                        <span className="text-xs text-muted">{p.role}</span>
                      </span>
                      <span className={clsx("text-xs font-medium", attendanceColor(p.attendancePct).text)}>
                        {p.attendancePct}%
                      </span>
                    </div>
                    <div className="mt-1.5 ml-7 h-1.5 overflow-hidden rounded-full bg-surface-2">
                      <div
                        className={clsx("h-full rounded-full", attendanceColor(p.attendancePct).bar)}
                        style={{ width: `${Math.min(p.attendancePct, 100)}%` }}
                      />
                    </div>
                  </Link>
                </li>
              ))}
            </ol>
          )}
        </div>

        <div className="rounded-lg border border-border bg-surface p-4">
          <div className="mb-3 flex items-baseline justify-between">
            <h2 className="text-sm font-semibold">Последние активности</h2>
            <Link href="/activities" className="text-xs text-accent hover:underline">
              Все
            </Link>
          </div>
          {recentActivities.length === 0 ? (
            <EmptyState title="Нет данных за выбранный период" />
          ) : (
            <ul className="divide-y divide-border">
              {recentActivities.map((a) => (
                <li key={a.id}>
                  <Link
                    href={`/activities/${a.id}`}
                    className="flex items-center justify-between px-2 py-3 text-sm hover:bg-surface-2"
                  >
                    <span>
                      <span className="font-medium">{a.name}</span>
                      <span className="ml-2 text-xs text-muted">{a.participants} участников</span>
                    </span>
                    <span className="text-xs text-muted">{a.date}</span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}
