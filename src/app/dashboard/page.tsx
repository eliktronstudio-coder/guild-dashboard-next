import Link from "next/link";
import clsx from "clsx";
import { Coins, Archive, Swords, CalendarClock } from "lucide-react";
import StatCard from "@/components/StatCard";
import TreasuryChart from "@/components/charts/TreasuryChart";
import AttendanceChart from "@/components/charts/AttendanceChart";
import EmptyState from "@/components/EmptyState";
import DashboardHero from "@/components/dashboard/DashboardHero";
import DashboardPanel from "@/components/dashboard/DashboardPanel";
import SectionHeader from "@/components/dashboard/SectionHeader";
import GuildRankRow from "@/components/dashboard/GuildRankRow";
import ActivityRow from "@/components/dashboard/ActivityRow";
import JapaneseCrest from "@/components/dashboard/JapaneseCrest";
import { daysUntilNextPayout } from "@/lib/payout";
import {
  topPlayersByAttendanceCategory,
  getAllActivities,
  getTreasuryBreakdown,
  getTreasuryChartData,
  getAttendanceChartData,
  getAvgActivityDays,
  getDropGoldTotal,
} from "@/lib/queries";

const numberFmt = new Intl.NumberFormat("ru-RU");

function attendanceTone(pct: number) {
  if (pct <= 20) return "text-danger";
  if (pct <= 50) return "text-accent-dim";
  return "text-accent-bright";
}

function CrestIcon({ size }: { size?: number; strokeWidth?: number }) {
  return <JapaneseCrest size={size ?? 16} />;
}

export default async function DashboardPage() {
  const [primeTop, miniRbTop, allActivities, treasuryBreakdown, treasuryChart, attendanceChart, avgActivityDays, dropGoldTotal] =
    await Promise.all([
      topPlayersByAttendanceCategory("attendancePctPrime", 5),
      topPlayersByAttendanceCategory("attendancePctMiniRb", 5),
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
    <div className="space-y-4">
      <div className="relative">
        <DashboardHero />

        <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-5">
          <StatCard
            variant="dashboard"
            label="Основная казна"
            value={`${numberFmt.format(treasuryBreakdown.main)} золота`}
            hint="70% — фонд ЗП"
            icon={Coins}
            tone="accent"
            strong
            goldValue
          />
          <StatCard
            variant="dashboard"
            label="Казна гильдии"
            value={`${numberFmt.format(treasuryBreakdown.guild)} золота`}
            hint="30% — резерв гильдии"
            icon={Archive}
            tone="violet"
            goldValue
          />
          <StatCard
            variant="dashboard"
            label="Дроп с РБ"
            value={`${numberFmt.format(dropGoldTotal)} золота`}
            hint="эквивалент в золоте"
            icon={Swords}
            tone="red"
            strong
            goldValue
          />
          <StatCard
            variant="dashboard"
            label="Ср. активность"
            value={avgActivityDays > 0 ? `${avgActivityDays} дней` : "—"}
            hint="между активностями"
            icon={CrestIcon}
            tone="info"
          />
          <StatCard
            variant="dashboard"
            label="Дней до выплаты"
            value={`${payoutDays}`}
            hint="выплата 15-го числа"
            icon={CalendarClock}
            tone="accent-dim"
          />
        </div>
      </div>

      <div className="grid grid-cols-1 gap-3.5 xl:grid-cols-2">
        <DashboardPanel className="min-w-0">
          <SectionHeader title="Динамика казны" right={<span className="text-xs text-muted">золото</span>} />
          <div className="min-h-[255px] max-h-[320px]">
            {treasuryChart.length === 0 ? (
              <EmptyState variant="dashboard" />
            ) : (
              <TreasuryChart data={treasuryChart} />
            )}
          </div>
        </DashboardPanel>
        <DashboardPanel className="min-w-0">
          <SectionHeader title="Посещаемость" right={<span className="text-xs text-muted">участия / день</span>} />
          <div className="min-h-[255px] max-h-[320px]">
            {attendanceChart.length === 0 ? (
              <EmptyState variant="dashboard" />
            ) : (
              <AttendanceChart data={attendanceChart} />
            )}
          </div>
        </DashboardPanel>
      </div>

      <div className="grid grid-cols-1 gap-3.5 xl:grid-cols-2">
        <DashboardPanel>
          <SectionHeader
            title="Посещаемость: Прайм"
            right={
              <div className="flex items-center gap-3">
                <span className="text-xs text-muted">за всё время</span>
                <Link href="/players" className="text-xs text-accent hover:underline">
                  Состав
                </Link>
              </div>
            }
          />
          {primeTop.length === 0 ? (
            <EmptyState variant="dashboard" title="Нет данных за выбранный период" />
          ) : (
            <div className="space-y-[5px]">
              {primeTop.map((p, i) => (
                <GuildRankRow
                  key={p.id}
                  href={`/players/${p.id}`}
                  rank={i + 1}
                  name={p.name}
                  role={p.role}
                  valueLabel={`${p.attendancePctPrime}%`}
                  valueClassName={clsx("font-mono", attendanceTone(p.attendancePctPrime))}
                />
              ))}
            </div>
          )}
        </DashboardPanel>

        <DashboardPanel>
          <SectionHeader
            title="Посещаемость: Мини-РБ"
            right={
              <div className="flex items-center gap-3">
                <span className="text-xs text-muted">за всё время</span>
                <Link href="/players" className="text-xs text-accent hover:underline">
                  Состав
                </Link>
              </div>
            }
          />
          {miniRbTop.length === 0 ? (
            <EmptyState variant="dashboard" title="Нет данных за выбранный период" />
          ) : (
            <div className="space-y-[5px]">
              {miniRbTop.map((p, i) => (
                <GuildRankRow
                  key={p.id}
                  href={`/players/${p.id}`}
                  rank={i + 1}
                  name={p.name}
                  role={p.role}
                  valueLabel={`${p.attendancePctMiniRb}%`}
                  valueClassName={clsx("font-mono", attendanceTone(p.attendancePctMiniRb))}
                />
              ))}
            </div>
          )}
        </DashboardPanel>
      </div>

      <DashboardPanel>
        <SectionHeader
          title="Последние активности"
          right={
            <Link href="/activities" className="text-xs text-accent hover:underline">
              Все
            </Link>
          }
        />
        {recentActivities.length === 0 ? (
          <EmptyState variant="dashboard" title="Нет данных за выбранный период" />
        ) : (
          <div className="space-y-[5px]">
            {recentActivities.map((a) => (
              <ActivityRow
                key={a.id}
                href={`/activities/${a.id}`}
                name={a.name}
                participants={a.participants}
                status={a.status}
                date={a.date}
              />
            ))}
          </div>
        )}
      </DashboardPanel>
    </div>
  );
}
