import AnalyticsChart from "@/components/reports/AnalyticsChart";
import { getStatistics } from "@/lib/statistics";
import { value, type ReportParams } from "@/lib/report-filters";
import { prisma } from "@/lib/prisma";
import { getActivePeriod } from "@/lib/period";
import { requireGuildMember } from "@/lib/access";
import Link from "next/link";
import clsx from "clsx";
import {
  Coins,
  Landmark,
  Archive,
  Swords,
  CalendarClock,
  Zap,
} from "lucide-react";
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
import DesignLayout from "@/components/design/DesignLayout";
import BlurGate from "@/components/BlurGate";
import { daysUntilNextPayout } from "@/lib/payout";
import { getCurrentUser } from "@/lib/auth";
import {
  getRecentActivities,
  getUpcomingActivities,
  getTreasuryBreakdown,
  getTreasuryChartCombined,
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

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<ReportParams>;
}) {
  const viewer = await requireGuildMember();
  const params = await searchParams;
  const report = await getStatistics(params, viewer, true);
  const active = await getActivePeriod();
  const paid = await prisma.payment.aggregate({
    where: { periodId: active.id, source: "payout", status: "Выплачено" },
    _sum: { amount: true },
  });
  const accruedRows = await import("@/lib/queries").then((q) =>
    q.getAllPlayers(),
  );
  const accrued = accruedRows.reduce((sum, p) => sum + p.salary, 0);
  const paidTotal = paid._sum.amount ?? 0;
  const upcoming = await getUpcomingActivities();
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
    Promise.resolve(
      [...report.rows]
        .sort((a, b) => b.prime - a.prime)
        .slice(0, 5)
        .map((p) => ({ ...p, attendancePctPrime: p.prime })),
    ),
    Promise.resolve(
      [...report.rows]
        .sort((a, b) => b.miniRb - a.miniRb)
        .slice(0, 5)
        .map((p) => ({ ...p, attendancePctMiniRb: p.miniRb })),
    ),
    getRecentActivities(),
    getTreasuryBreakdown(),
    getTreasuryChartCombined(),
    Promise.resolve(
      report.daily.map((d) => ({ date: d.date, count: d.count })),
    ),
    Promise.resolve(report.summary.average ?? 0),
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
    if (banner)
      scheduleBanners[name] = { id: banner.id, isVideo: banner.isVideo };
  }
  const recentActivities = allActivities.slice(0, 5).map((a) => {
    const banner = findLabelMatch(a.name, bannerNames);
    return {
      ...a,
      bannerId: banner?.id ?? null,
      bannerIsVideo: banner?.isVideo ?? false,
    };
  });

  const payoutDays = daysUntilNextPayout();
  const isRandom = user?.role === "random";

  // Две секции: блок показателей с баннером и настраиваемая сетка панелей.
  // Внутренний порядок панелей в сетке пользователь меняет сам на странице.
  const sections: Record<string, React.ReactNode> = {
    "dashboard.kpi": (
      <div className="relative lg:pt-60">
        <DashboardHero />

        <div
          data-design-el="dashboard.kpiGrid"
          className="grid grid-cols-1 gap-3 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-4"
        >
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
            value={
              report.summary.average !== null ? `${avgAttendance30d} чел.` : "—"
            }
            hint="за выбранный период"
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
    ),

    "dashboard.panels": (
      <CustomizableGrid
        panels={[
          {
            id: "treasury-chart",
            label: "Динамика казны",
            defaultSpan: 4,
            content: (
              <DashboardPanel className="min-w-0">
                <SectionHeader
                  title="Динамика казны"
                  right={<span className="text-xs text-muted">золото</span>}
                />
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
                <SectionHeader
                  title="Посещаемость"
                  right={
                    <span className="text-xs text-muted">участия / день</span>
                  }
                />
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
                      <span className="text-xs text-muted">
                        за выбранный период
                      </span>
                      <Link
                        href="/players"
                        className="text-xs text-accent hover:underline"
                      >
                        Состав
                      </Link>
                    </div>
                  }
                />
                {primeTop.length === 0 ? (
                  <EmptyState
                    variant="dashboard"
                    title="Нет данных за выбранный период"
                  />
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
                        valueClassName={clsx(
                          "font-mono",
                          attendanceTone(p.attendancePctPrime),
                        )}
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
                      <span className="text-xs text-muted">
                        за выбранный период
                      </span>
                      <Link
                        href="/players"
                        className="text-xs text-accent hover:underline"
                      >
                        Состав
                      </Link>
                    </div>
                  }
                />
                {miniRbTop.length === 0 ? (
                  <EmptyState
                    variant="dashboard"
                    title="Нет данных за выбранный период"
                  />
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
                        valueClassName={clsx(
                          "font-mono",
                          attendanceTone(p.attendancePctMiniRb),
                        )}
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
                    <Link
                      href="/activities"
                      className="text-xs text-accent hover:underline"
                    >
                      Все
                    </Link>
                  }
                />
                {recentActivities.length === 0 ? (
                  <EmptyState
                    variant="dashboard"
                    title="Нет данных за выбранный период"
                  />
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
                        bannerUrl={
                          a.bannerId
                            ? `/api/activity-banners/${a.bannerId}/media`
                            : null
                        }
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
    ),
  };

  return (
    <div className="space-y-5">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="font-heading text-xl">Командный центр XD</h2>
          <p className="text-sm text-muted">Расчётный период: {active.label}</p>
        </div>
        <Link className="text-sm text-accent underline" href="/statistics">
          Подробная статистика
        </Link>
      </header>
      <form method="get" className="flex flex-wrap items-end gap-3">
        <label className="text-sm text-muted">
          Период посещаемости
          <select
            className="ml-3 min-h-11 rounded-lg border border-border bg-surface px-3"
            name="period"
            defaultValue={value(params.period) || "current"}
          >
            <option value="current">Текущий расчётный</option>
            <option value="previous">Предыдущий расчётный</option>
            <option value="7">Последние 7 дней</option>
            <option value="30">Последние 30 дней</option>
          </select>
        </label>
        <button className="min-h-11 rounded-lg border border-accent/40 px-4 text-sm text-accent">
          Применить
        </button>
      </form>
      <div className="grid gap-3 sm:grid-cols-3">
        <StatCard
          label="Начислено за текущий период"
          value={numberFmt.format(accrued) + " золота"}
          hint="исходный фонд периода"
        />
        <StatCard
          label="Выплачено"
          value={numberFmt.format(paidTotal) + " золота"}
          hint="фактические выплаты периода"
        />
        <StatCard
          label="Осталось выплатить"
          value={numberFmt.format(Math.max(0, accrued - paidTotal)) + " золота"}
          hint="начислено минус выплачено"
        />
      </div>
      <DashboardPanel>
        <SectionHeader
          title="Ближайшие запланированные события"
          right={
            <Link
              href="/activities?status=Запланировано"
              className="text-sm text-accent"
            >
              Все события
            </Link>
          }
        />
        <div className="grid gap-3 md:grid-cols-2">
          {upcoming.length ? (
            upcoming.map((a) => (
              <ActivityRow
                key={a.id}
                href={`/activities/${a.id}`}
                name={a.name}
                date={a.date}
                status={a.status}
                participants={a.participants}
              />
            ))
          ) : (
            <EmptyState
              title="Нет запланированных событий"
              hint="Регулярное игровое расписание показано отдельно ниже."
            />
          )}
        </div>
      </DashboardPanel>
      <AnalyticsChart
        title="Доходы и расходы за выбранный период"
        data={report.daily}
        series={[
          { key: "income", label: "Доходы", color: "var(--success)" },
          { key: "expense", label: "Расходы", color: "var(--danger)" },
        ]}
      />
      <BlurGate blurred={isRandom}>
        <DesignLayout
          pageKey="dashboard"
          designId="dashboard.root"
          sections={sections}
          className="space-y-4"
        />
      </BlurGate>
    </div>
  );
}
