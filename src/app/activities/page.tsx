import { getFilteredActivities, getDistinctActivityNames, getRegisteredPlayers, getDropCatalog } from "@/lib/queries";
import { getCurrentUser } from "@/lib/auth";
import ActivitiesList from "@/components/admin/ActivitiesList";

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

  const [result, distinctNames, players, user, catalog] = await Promise.all([
    getFilteredActivities(filters),
    getDistinctActivityNames(),
    getRegisteredPlayers(),
    getCurrentUser(),
    getDropCatalog(),
  ]);

  return (
    <ActivitiesList
      activities={result.activities}
      total={result.total}
      totalPages={result.totalPages}
      filters={filters}
      distinctNames={distinctNames}
      players={players.map((p) => ({ id: p.id, name: p.name, role: p.role }))}
      catalog={catalog.map((c) => ({ id: c.id, name: c.name, price: c.price }))}
      isAdmin={user?.role === "admin"}
    />
  );
}
