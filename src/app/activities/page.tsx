import {
  getFilteredActivities,
  getDistinctActivityNames,
  getRegisteredPlayers,
  getAllPlayers,
  getDropCatalog,
  getActivityBanners,
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

  const [result, distinctNames, players, allPlayers, user, catalog, banners] = await Promise.all([
    getFilteredActivities(filters),
    getDistinctActivityNames(),
    getRegisteredPlayers(),
    getAllPlayers(),
    getCurrentUser(),
    getDropCatalog(),
    getActivityBanners(),
  ]);

  // Названия активностей приходят из игры вразнобой («АГЛ Т1», «морф»), поэтому
  // баннер ищется тем же подбором, что и ники: точное -> по началу -> опечатка.
  const bannerByName = new Map<string, string | null>();
  function resolveBanner(name: string) {
    if (!bannerByName.has(name)) {
      bannerByName.set(name, findLabelMatch(name, banners)?.imageUrl ?? null);
    }
    return bannerByName.get(name) ?? null;
  }

  const counts = result.activities.map((a) => a.participants);
  const avgAttendance = counts.length ? Math.round(counts.reduce((s, c) => s + c, 0) / counts.length) : 0;
  const bestAttendance = counts.length ? Math.max(...counts) : 0;
  const cancelled = result.activities.filter((a) => a.status === "Отменено").length;

  return (
    <BlurGate blurred={user?.role === "random"}>
      <ActivitiesList
        activities={result.activities.map((a) => ({ ...a, bannerUrl: resolveBanner(a.name) }))}
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
