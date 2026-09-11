import Link from "next/link";
import clsx from "clsx";
import DashboardPanel from "@/components/dashboard/DashboardPanel";
import SectionHeader from "@/components/dashboard/SectionHeader";
import GuildRankRow from "@/components/dashboard/GuildRankRow";
import ActivityRow from "@/components/dashboard/ActivityRow";
import SchedulePanel from "@/components/dashboard/SchedulePanel";
import DailyAttendanceChart from "@/components/charts/DailyAttendanceChart";
import EmptyState from "@/components/EmptyState";
import BlurValue from "@/components/BlurValue";
import { getCurrentUser } from "@/lib/auth";
import {
  getPlayerByUserId,
  getPlayerDailyAttendance,
  topPlayersByAttendanceCategory,
  getAllActivities,
  getActivityBannerNames,
} from "@/lib/queries";
import { findLabelMatch } from "@/lib/nameMatch";
import { SCHEDULE } from "@/lib/schedule";

function attendanceTone(pct: number) {
  if (pct <= 20) return "text-danger";
  if (pct <= 50) return "text-accent-dim";
  return "text-accent-bright";
}

/** Подсказка вместо личных блоков, когда показывать нечего. */
function PersonalPlaceholder({ user }: { user: { username: string } | null }) {
  return (
    <EmptyState
      variant="dashboard"
      title={user ? "Аккаунт не привязан к игроку" : "Вы не вошли"}
      hint={
        user
          ? "Попросите админа привязать ваш аккаунт к игроку в составе гильдии."
          : "Войдите, чтобы увидеть свою посещаемость."
      }
    />
  );
}

export default async function HomePage() {
  const user = await getCurrentUser();

  // Личные блоки завязаны на игрока, привязанного к аккаунту: без входа или
  // без привязки показываем подсказку, а не пустую сетку.
  const player = user ? await getPlayerByUserId(user.sub) : null;

  const [dailyAttendance, primeTop, miniRbTop, allActivities, bannerNames] = await Promise.all([
    player ? getPlayerDailyAttendance(player.id, 30) : Promise.resolve([]),
    topPlayersByAttendanceCategory("attendancePctPrime", 5),
    topPlayersByAttendanceCategory("attendancePctMiniRb", 5),
    getAllActivities(),
    getActivityBannerNames(),
  ]);

  // Баннеры отдаём ссылкой на /api/activity-banners/[id]/media, а не телом
  // картинки в пропсах клиентских компонентов — см. dashboard/page.tsx.
  const scheduleBanners: Record<string, { id: string; isVideo: boolean }> = {};
  for (const name of new Set(SCHEDULE.map((s) => s.name))) {
    const banner = findLabelMatch(name, bannerNames);
    if (banner) scheduleBanners[name] = { id: banner.id, isVideo: banner.isVideo };
  }
  const recentActivities = allActivities.slice(0, 3).map((a) => {
    const banner = findLabelMatch(a.name, bannerNames);
    return { ...a, bannerId: banner?.id ?? null, bannerIsVideo: banner?.isVideo ?? false };
  });

  const isRandom = user?.role === "random";

  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
      {/* Слева вверху — личная посещаемость того, кто открыл страницу. */}
      <DashboardPanel className="min-w-0">
        <SectionHeader
          title="Моя посещаемость"
          right={
            player ? (
              <Link href="/profile" className="text-xs text-accent hover:underline">
                Профиль
              </Link>
            ) : undefined
          }
        />
        {!player ? (
          <PersonalPlaceholder user={user} />
        ) : (
          <div className="space-y-3">
            <div className="flex items-center gap-3">
              <span className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-full bg-accent-soft text-base font-semibold text-accent-bright">
                {player.name.charAt(0).toUpperCase()}
              </span>
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold text-foreground">{player.name}</p>
                <p className="truncate text-xs text-muted">{player.role}</p>
              </div>
            </div>
            <div className="grid grid-cols-3 gap-2">
              {[
                { label: "Общая", value: player.attendancePct },
                { label: "Прайм", value: player.attendancePctPrime },
                { label: "Мини-РБ", value: player.attendancePctMiniRb },
              ].map((s) => (
                <div key={s.label} className="rounded-lg border border-border bg-surface-2 px-3 py-2.5">
                  <p className="text-[11px] text-muted">{s.label}</p>
                  <BlurValue blurred={isRandom}>
                    <p className={clsx("font-mono text-xl font-semibold", attendanceTone(s.value))}>{s.value}%</p>
                  </BlurValue>
                </div>
              ))}
            </div>
          </div>
        )}
      </DashboardPanel>

      {/* Справа вверху — личный график посещаемости. */}
      <DashboardPanel className="min-w-0">
        <SectionHeader
          title="Мой график посещаемости"
          right={<span className="text-xs text-muted">за 30 дней</span>}
        />
        {!player ? (
          <PersonalPlaceholder user={user} />
        ) : (
          <div className="min-h-[220px]">
            <BlurValue blurred={isRandom}>
              <DailyAttendanceChart data={dailyAttendance} />
            </BlurValue>
          </div>
        )}
      </DashboardPanel>

      {/* Слева ниже статистики — ближайшие активности. */}
      <DashboardPanel className="min-w-0">
        <SectionHeader title="До активностей" right={<span className="text-xs text-muted">по МСК</span>} />
        <SchedulePanel banners={scheduleBanners} />
      </DashboardPanel>

      {/* Справа под графиком — последние активности. */}
      <DashboardPanel className="min-w-0">
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

      {/* Слева внизу — лидеры по Прайму. */}
      <DashboardPanel className="min-w-0">
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

      {/* Справа внизу — лидеры по Мини-РБ. */}
      <DashboardPanel className="min-w-0">
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
  );
}
