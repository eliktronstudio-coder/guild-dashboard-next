import Link from "next/link";
import {
  Coins,
  Users,
  Swords,
  CalendarClock,
  LayoutDashboard,
  Landmark,
  Wallet,
  UserCircle,
  ArrowRight,
} from "lucide-react";
import StatCard from "@/components/StatCard";
import DashboardHero from "@/components/dashboard/DashboardHero";
import DashboardPanel from "@/components/dashboard/DashboardPanel";
import SectionHeader from "@/components/dashboard/SectionHeader";
import ActivityRow from "@/components/dashboard/ActivityRow";
import EmptyState from "@/components/EmptyState";
import BlurGate from "@/components/BlurGate";
import { guild } from "@/lib/config";
import { getCurrentUser } from "@/lib/auth";
import { daysUntilNextPayout } from "@/lib/payout";
import { getAllPlayers, getAllActivities, getTreasuryGold, getActivityBannerNames } from "@/lib/queries";
import { findLabelMatch } from "@/lib/nameMatch";

const numberFmt = new Intl.NumberFormat("ru-RU");

const shortcuts = [
  { href: "/dashboard", label: "Статистика", hint: "Казна, посещаемость, лидеры", icon: LayoutDashboard },
  { href: "/activities", label: "Активность", hint: "Рейды, дроп, участники", icon: Swords },
  { href: "/players", label: "Состав", hint: "Игроки и их посещаемость", icon: Users },
  { href: "/treasury", label: "Казна", icon: Landmark, hint: "Операции и склады" },
  { href: "/payments", label: "Выплаты", hint: "Зарплата по итогам месяца", icon: Wallet },
  { href: "/profile", label: "Мой профиль", hint: "Личная статистика", icon: UserCircle },
];

export default async function HomePage() {
  const [user, players, activities, treasuryGold, bannerNames] = await Promise.all([
    getCurrentUser(),
    getAllPlayers(),
    getAllActivities(),
    getTreasuryGold(),
    getActivityBannerNames(),
  ]);

  // Баннер отдаём ссылкой на /api/activity-banners/[id]/media, а не телом
  // картинки в пропсах — см. комментарий в dashboard/page.tsx.
  const recentActivities = activities.slice(0, 5).map((a) => {
    const banner = findLabelMatch(a.name, bannerNames);
    return { ...a, bannerId: banner?.id ?? null, bannerIsVideo: banner?.isVideo ?? false };
  });

  const payoutDays = daysUntilNextPayout();
  const isRandom = user?.role === "random";

  return (
    <div className="space-y-4">
      <div className="relative lg:pt-40">
        <DashboardHero />

        <div className="mb-4">
          <h1 className="font-heading text-2xl font-bold text-foreground">
            Гильдия {guild.name}
          </h1>
          <p className="mt-1 text-sm text-muted">
            {user ? `С возвращением, ${user.username}.` : "Добро пожаловать."} Отсюда — быстрый переход в любой раздел.
          </p>
        </div>

        <BlurGate blurred={isRandom}>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <StatCard
              variant="dashboard"
              label="Казна гильдии"
              value={`${numberFmt.format(treasuryGold)} золота`}
              hint="суммарно по операциям"
              icon={Coins}
              tone="accent"
              strong
              goldValue
              href="/treasury"
            />
            <StatCard
              variant="dashboard"
              label="Состав"
              value={`${players.length} чел.`}
              hint="игроков в гильдии"
              icon={Users}
              tone="info"
              href="/players"
            />
            <StatCard
              variant="dashboard"
              label="Активностей"
              value={`${activities.length}`}
              hint="за всё время"
              icon={Swords}
              tone="ember"
              href="/activities"
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
        </BlurGate>
      </div>

      <DashboardPanel>
        <SectionHeader title="Разделы" />
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 xl:grid-cols-3">
          {shortcuts.map(({ href, label, hint, icon: Icon }) => (
            <Link
              key={href}
              href={href}
              className="group flex items-center gap-3 rounded-xl border border-border bg-surface-2 px-4 py-3 transition-colors hover:border-accent/40"
            >
              <span className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-lg bg-surface text-accent-bright">
                <Icon size={18} />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-medium text-foreground">{label}</span>
                <span className="block truncate text-xs text-muted">{hint}</span>
              </span>
              <ArrowRight
                size={16}
                className="flex-shrink-0 text-muted transition-transform group-hover:translate-x-0.5 group-hover:text-accent"
              />
            </Link>
          ))}
        </div>
      </DashboardPanel>

      <BlurGate blurred={isRandom}>
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
            <EmptyState variant="dashboard" title="Пока нет активностей" />
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
      </BlurGate>
    </div>
  );
}
