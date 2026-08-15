import { getFilteredActivities, getDistinctActivityNames, getRegisteredPlayers, getAllPlayers, getDropCatalog } from "@/lib/queries";
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

  const [result, distinctNames, players, allPlayers, user, catalog] = await Promise.all([
    getFilteredActivities(filters),
    getDistinctActivityNames(),
    getRegisteredPlayers(),
    getAllPlayers(),
    getCurrentUser(),
    getDropCatalog(),
  ]);

  const counts = result.activities.map((a) => a.participants);
  const avgAttendance = counts.length ? Math.round(counts.reduce((s, c) => s + c, 0) / counts.length) : 0;
  const bestAttendance = counts.length ? Math.max(...counts) : 0;
  const cancelled = result.activities.filter((a) => a.status === "Отменено").length;

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
      summary={{
        total: result.total,
        avgAttendance,
        bestAttendance,
        cancelled,
        totalPlayers: allPlayers.length,
      }}
    />
  );
}
