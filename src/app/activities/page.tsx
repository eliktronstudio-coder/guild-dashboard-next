import {
  getFilteredActivities,
  getDistinctActivityNames,
  getRegisteredPlayers,
  getAllPlayers,
  getDropCatalog,
  getActivityBannerNames,
  getActivityBannersByIds,
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
  // Сопоставляем по id, не по картинке — баннеры бывают видео до ~12 МБ, и
  // встраивать их в каждую строку таблицы (даже дублируя один и тот же
  // баннер на несколько одноимённых активностей) резко раздувает страницу.
  const bannerIdByName = new Map<string, string | null>();
  function resolveBannerId(name: string) {
    if (!bannerIdByName.has(name)) {
      bannerIdByName.set(name, findLabelMatch(name, bannerNames)?.id ?? null);
    }
    return bannerIdByName.get(name) ?? null;
  }

  const activitiesWithBannerId = result.activities.map((a) => ({ ...a, bannerId: resolveBannerId(a.name) }));
  const neededBannerIds = [...new Set(activitiesWithBannerId.map((a) => a.bannerId).filter((id): id is string => id !== null))];
  const bannerRecords = await getActivityBannersByIds(neededBannerIds);
  const bannerUrlById = Object.fromEntries(bannerRecords.map((b) => [b.id, b.imageUrl]));

  const counts = result.activities.map((a) => a.participants);
  const avgAttendance = counts.length ? Math.round(counts.reduce((s, c) => s + c, 0) / counts.length) : 0;
  const bestAttendance = counts.length ? Math.max(...counts) : 0;
  const cancelled = result.activities.filter((a) => a.status === "Отменено").length;

  return (
    <BlurGate blurred={user?.role === "random"}>
      <ActivitiesList
        activities={activitiesWithBannerId}
        banners={bannerUrlById}
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
