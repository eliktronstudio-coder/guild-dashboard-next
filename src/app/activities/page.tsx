import {
  getFilteredActivities,
  getDistinctActivityNames,
  getRegisteredPlayers,
  getAllPlayers,
  getDropCatalog,
  getActivityBannerNames,
} from "@/lib/queries";
import { findLabelMatch } from "@/lib/nameMatch";
import { getCurrentUser } from "@/lib/auth";
import { canManageActivitiesRole } from "@/lib/accountRoles";
import ActivitiesList from "@/components/admin/ActivitiesList";
import BlurGate from "@/components/BlurGate";

type SearchParams = { [key: string]: string | string[] | undefined };

function str(v: string | string[] | undefined): string | undefined {
  return typeof v === "string" && v ? v : undefined;
}

export default async function ActivitiesPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const sp = await searchParams;
  const filters = {
    dateFrom: str(sp.dateFrom),
    dateTo: str(sp.dateTo),
    status: str(sp.status),
    mode: str(sp.mode),
    category: str(sp.category),
    name: str(sp.name),
    player: str(sp.player),
    page: sp.page && typeof sp.page === "string" ? Math.max(1, Number(sp.page) || 1) : 1,
  };

  const [result, distinctNames, players, allPlayers, user, catalog, bannerNames] = await Promise.all([
    getFilteredActivities(filters),
    getDistinctActivityNames(),
    getRegisteredPlayers(),
    getAllPlayers(),
    getCurrentUser(),
    getDropCatalog(),
    getActivityBannerNames(),
  ]);

  // Названия активностей приходят из игры вразнобой («АГЛ Т1», «морф»), поэтому
  // баннер ищется тем же подбором, что и ники: точное -> по началу -> опечатка.
  // В строку кладём только id + isVideo — сам файл (баннеры бывают видео до
  // ~12 МБ) отдаётся отдельным HTTP-запросом на /api/activity-banners/[id]/media,
  // а не встраивается в пропсы: иначе Next дублирует эти байты в
  // hydration-payload поверх уже отрендеренного HTML.
  const bannerByName = new Map<string, { id: string; isVideo: boolean } | null>();
  function resolveBanner(name: string) {
    if (!bannerByName.has(name)) {
      const match = findLabelMatch(name, bannerNames);
      bannerByName.set(name, match ? { id: match.id, isVideo: match.isVideo } : null);
    }
    return bannerByName.get(name) ?? null;
  }

  const activitiesWithBanner = result.activities.map((a) => {
    const banner = resolveBanner(a.name);
    return { ...a, bannerId: banner?.id ?? null, bannerIsVideo: banner?.isVideo ?? false };
  });

  const counts = result.activities.map((a) => a.participants);
  const avgAttendance = counts.length ? Math.round(counts.reduce((s, c) => s + c, 0) / counts.length) : 0;
  const bestAttendance = counts.length ? Math.max(...counts) : 0;
  const cancelled = result.activities.filter((a) => a.status === "Отменено").length;

  return (
    <BlurGate blurred={user?.role === "random"}>
      <ActivitiesList
        activities={activitiesWithBanner}
        total={result.total}
        totalPages={result.totalPages}
        filters={filters}
        distinctNames={distinctNames}
        players={players.map((p) => ({ id: p.id, name: p.name, role: p.role }))}
        catalog={catalog.map((c) => ({ id: c.id, name: c.name, price: c.price }))}
        isAdmin={canManageActivitiesRole(user?.role)}
        summary={{
          total: result.total,
          avgAttendance,
          bestAttendance,
          cancelled,
          totalPlayers: allPlayers.length,
        }}
      />
    </BlurGate>
  );
}
