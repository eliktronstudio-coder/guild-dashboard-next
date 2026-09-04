import Link from "next/link";
import clsx from "clsx";
import { Coins, Landmark, Archive, Swords, CalendarClock, Zap } from "lucide-react";
import StatCard from "@/components/StatCard";
import TreasuryChart from "@/components/charts/TreasuryChart";
import AttendanceChart from "@/components/charts/AttendanceChart";
import EmptyState from "@/components/EmptyState";
import DashboardHero from "@/components/dashboard/DashboardHero";
import DashboardPanel from "@/components/dashboard/DashboardPanel";
import SectionHeader from "@/components/dashboard/SectionHeader";
import GuildRankRow from "@/components/dashboard/GuildRankRow";
import ActivityRow from "@/components/dashboard/ActivityRow";
import SchedulePanel from "@/components/dashboard/SchedulePanel";
import CustomizableGrid from "@/components/dashboard/CustomizableGrid";
import BlurGate from "@/components/BlurGate";
import { daysUntilNextPayout } from "@/lib/payout";
import { getCurrentUser } from "@/lib/auth";
import {
  topPlayersByAttendanceCategory,
  getAllActivities,
  getTreasuryBreakdown,
  getTreasuryChartCombined,
  getAttendanceChartData,
  getAvgAttendanceLast30Days,
  getDropGoldGeneralAuto,
  getDropGoldPrimeManual,
  getDropGoldMiniRb,
  getActivityBannerNames,
} from "@/lib/queries";
import { findLabelMatch } from "@/lib/nameMatch";
import { SCHEDULE } from "@/lib/schedule";

const numberFmt = new Intl.NumberFormat("ru-RU");

// Photographic artwork behind each KPI card / leaderboard panel (see public/dashboard/art).
const art = {
  prime: "/dashboard/art/kpi-prime.webp",
  miniRb: "/dashboard/art/kpi-minirb.webp",
  guild: "/dashboard/art/kpi-guild.webp",
  drop: "/dashboard/art/kpi-drop.webp",
  dropGeneral: "/dashboard/art/kpi-drop-general.webp",
  attendance: "/dashboard/art/kpi-attendance.webp",
  payout: "/dashboard/art/kpi-payout.webp",
  leadersPrime: "/dashboard/art/leaders-prime.webp",
  leadersMiniRb: "/dashboard/art/leaders-minirb.webp",
};

function attendanceTone(pct: number) {
  if (pct <= 20) return "text-danger";
  if (pct <= 50) return "text-accent-dim";
  return "text-accent-bright";
}

export default async function DashboardPage() {
  const [
    user,
    primeTop,
    miniRbTop,
    allActivities,
    treasuryBreakdown,
    treasuryChart,
    attendanceChart,
    avgAttendance30d,
    dropGoldGeneralAuto,
    dropGoldPrimeManual,
    dropGoldMiniRb,
    bannerNames,
  ] = await Promise.all([
    getCurrentUser(),
    topPlayersByAttendanceCategory("attendancePctPrime", 5),
    topPlayersByAttendanceCategory("attendancePctMiniRb", 5),
    getAllActivities(),
    getTreasuryBreakdown(),
    getTreasuryChartCombined(),
    getAttendanceChartData(),
    getAvgAttendanceLast30Days(),
    getDropGoldGeneralAuto(),
    getDropGoldPrimeManual(),
    getDropGoldMiniRb(),
    getActivityBannerNames(),
  ]);

  // Баннер отдаётся отдельным HTTP-запросом на /api/activity-banners/[id]/media,
  // а не встраивается в пропсы клиентских компонентов (SchedulePanel, ActivityRow):
  // баннеры бывают видео до ~12 МБ, и Next дублирует такие пропсы в
  // hydration-payload поверх уже отрендеренного HTML — страница раздувалась
  // на десятки мегабайт. В пропсы кладём только id + isVideo.
  const scheduleBanners: Record<string, { id: string; isVideo: boolean }> = {};
  for (const name of new Set(SCHEDULE.map((s) => s.name))) {
    const banner = findLabelMatch(name, bannerNames);
    if (banner) scheduleBanners[name] = { id: banner.id, isVideo: banner.isVideo };
  }
  const recentActivities = allActivities.slice(0, 5).map((a) => {
    const banner = findLabelMatch(a.name, bannerNames);
    return { ...a, bannerId: banner?.id ?? null, bannerIsVideo: banner?.isVideo ?? false };
  });

  const payoutDays = daysUntilNextPayout();
  const isRandom = user?.role === "random";

  return (
    <BlurGate blurred={isRandom}>
    <div className="space-y-4">
      {/* Отступ на две высоты карточки открывает баннер, который иначе почти
          целиком закрыт KPI-блоком. Это padding обёртки, а не margin сетки:
          margin схлопнулся бы через обёртку и утащил баннер вниз вместе с
          карточками. На узких экранах не нужен — карточки идут в одну колонку. */}
      <div className="relative lg:pt-60">
        <DashboardHero />

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-4">
          <StatCard
            variant="dashboard"
            label="Казна с Прайма"
            art={art.prime}
            value={`${numberFmt.format(treasuryBreakdown.prime)} золота`}
            hint="70% — фонд ЗП"
            icon={Coins}
            tone="accent"
            strong
            goldValue
          />
          <StatCard
            variant="dashboard"
            label="Казна мини-РБ"
            art={art.miniRb}
            value={`${numberFmt.format(treasuryBreakdown.miniRb)} золота`}
            hint="100% — фонд ЗП"
            icon={Landmark}
            tone="ember"
            goldValue
          />
          <StatCard
            variant="dashboard"
            label="Казна гильдии"
            art={art.guild}
            value={`${numberFmt.format(treasuryBreakdown.guild)} золота`}
            hint="30% — резерв гильдии"
            icon={Archive}
            tone="violet"
            goldValue
          />
          <StatCard
            variant="dashboard"
            label="Дроп с Мини-РБ / Дроп с Прайм"
            art={art.drop}
            value={`${numberFmt.format(dropGoldMiniRb)} / ${numberFmt.format(dropGoldPrimeManual)} золота`}
            hint="склад ХД / ручной дроп"
            icon={Swords}
            tone="red"
            goldValue
            href="/treasury"
          />
          <StatCard
            variant="dashboard"
            label="Дроп общего инвентаря"
            art={art.dropGeneral}
            value={`${numberFmt.format(dropGoldGeneralAuto)} золота`}
            hint="эквивалент в золоте"
            icon={Swords}
            tone="red"
            strong
            goldValue
            href="/treasury"
          />
          <StatCard
            variant="dashboard"
            label="Ср. посещаемость"
            art={art.attendance}
            value={avgAttendance30d > 0 ? `${avgAttendance30d} чел.` : "—"}
            hint="за последние 30 дней"
            icon={Zap}
            tone="info"
          />
          <StatCard
            variant="dashboard"
            label="Дней до выплаты"
            art={art.payout}
            value={`${payoutDays}`}
            hint="выплата 15-го числа"
            icon={CalendarClock}
            tone="accent-dim"
          />
        </div>
      </div>

      <CustomizableGrid
        panels={[
          {
            id: "treasury-chart",
            label: "Динамика казны",
            defaultSpan: 4,
            content: (
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
            ),
          },
          {
            id: "attendance-chart",
            label: "Посещаемость",
            defaultSpan: 4,
            content: (
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
            ),
          },
          {
            id: "schedule",
            label: "До активностей",
            defaultSpan: 4,
            content: (
              <DashboardPanel className="min-w-0">
                <SectionHeader
                  title="До активностей"
                  right={<span className="text-xs text-muted">по МСК</span>}
                />
                <SchedulePanel banners={scheduleBanners} />
              </DashboardPanel>
            ),
          },
          {
            id: "leaders-prime",
            label: "Посещаемость: Прайм",
            defaultSpan: 4,
            content: (
              <DashboardPanel art={art.leadersPrime}>
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
            ),
          },
          {
            id: "leaders-minirb",
            label: "Посещаемость: Мини-РБ",
            defaultSpan: 4,
            content: (
              <DashboardPanel art={art.leadersMiniRb}>
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
            ),
          },
          {
            id: "recent-activities",
            label: "Последние активности",
            defaultSpan: 4,
            content: (
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
                        bannerUrl={a.bannerId ? `/api/activity-banners/${a.bannerId}/media` : null}
                        bannerIsVideo={a.bannerIsVideo}
                      />
                    ))}
                  </div>
                )}
              </DashboardPanel>
            ),
          },
        ]}
      />
    </div>
    </BlurGate>
  );
}
