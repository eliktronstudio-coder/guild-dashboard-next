import Link from "next/link";
import StatCard from "@/components/StatCard";
import TreasuryChart from "@/components/charts/TreasuryChart";
import AttendanceChart from "@/components/charts/AttendanceChart";
import {
  stats,
  treasuryHistory,
  attendanceHistory,
  activities,
  topByAttendance,
  topByXp,
} from "@/lib/mock-data";

const numberFmt = new Intl.NumberFormat("ru-RU");

export default function DashboardPage() {
  const attendanceTop = topByAttendance(5);
  const xpTop = topByXp(5);

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
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
          label="Ср. активность"
          value={`${stats.avgActivityDays} дней`}
          hint="—"
        />
        <StatCard
          label="Дней до выплаты"
          value={`${stats.daysUntilPayout}`}
          hint="до дня выплат"
        />
      </div>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
        <div className="rounded-lg border border-border bg-surface p-4">
          <div className="mb-2 flex items-baseline justify-between">
            <h2 className="text-sm font-semibold">Динамика казны</h2>
            <span className="text-xs text-muted">золото + инвентарь</span>
          </div>
          <TreasuryChart data={treasuryHistory} />
        </div>
        <div className="rounded-lg border border-border bg-surface p-4">
          <div className="mb-2 flex items-baseline justify-between">
            <h2 className="text-sm font-semibold">Посещаемость</h2>
            <span className="text-xs text-muted">участия / день</span>
          </div>
          <AttendanceChart data={attendanceHistory} />
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
        <div className="rounded-lg border border-border bg-surface p-4">
          <div className="mb-3 flex items-baseline justify-between">
            <h2 className="text-sm font-semibold">Топ по посещаемости</h2>
            <div className="flex items-center gap-3">
              <span className="text-xs text-muted">30 дней</span>
              <Link href="/players" className="text-xs text-accent hover:underline">
                Состав
              </Link>
            </div>
          </div>
          <ol className="space-y-1">
            {attendanceTop.map((p, i) => (
              <li key={p.id}>
                <Link
                  href={`/players/${p.id}`}
                  className="flex items-center justify-between rounded-md px-2 py-2 text-sm hover:bg-surface-2"
                >
                  <span className="flex items-center gap-3">
                    <span className="w-4 text-muted">{i + 1}</span>
                    <span className="font-medium">{p.name}</span>
                    <span className="text-xs text-muted">{p.role}</span>
                  </span>
                  <span className="text-xs font-medium text-accent">{p.attendancePct}%</span>
                </Link>
              </li>
            ))}
          </ol>
        </div>

        <div className="rounded-lg border border-border bg-surface p-4">
          <div className="mb-3 flex items-baseline justify-between">
            <h2 className="text-sm font-semibold">Топ по достижениям</h2>
            <div className="flex items-center gap-3">
              <span className="text-xs text-muted">коллекция</span>
              <Link href="/players" className="text-xs text-accent hover:underline">
                Состав
              </Link>
            </div>
          </div>
          <ol className="space-y-1">
            {xpTop.map((p, i) => (
              <li key={p.id}>
                <Link
                  href={`/players/${p.id}`}
                  className="flex items-center justify-between rounded-md px-2 py-2 text-sm hover:bg-surface-2"
                >
                  <span className="flex items-center gap-3">
                    <span className="w-4 text-muted">{i + 1}</span>
                    <span className="font-medium">{p.name}</span>
                    <span className="text-xs text-muted">{p.role}</span>
                  </span>
                  <span className="text-xs text-muted">
                    {p.level} ур. · {numberFmt.format(p.xp)} XP
                  </span>
                </Link>
              </li>
            ))}
          </ol>
        </div>
      </div>

      <div className="rounded-lg border border-border bg-surface p-4">
        <div className="mb-3 flex items-baseline justify-between">
          <h2 className="text-sm font-semibold">Последние активности</h2>
          <Link href="/activities" className="text-xs text-accent hover:underline">
            Все
          </Link>
        </div>
        <ul className="divide-y divide-border">
          {activities.map((a) => (
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
      </div>
    </div>
  );
}
