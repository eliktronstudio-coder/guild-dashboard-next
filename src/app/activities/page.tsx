import { getAllActivities, getRegisteredPlayers } from "@/lib/queries";
import { getCurrentUser } from "@/lib/auth";
import ActivitiesList from "@/components/admin/ActivitiesList";

export default async function ActivitiesPage() {
  const [activities, players, user] = await Promise.all([
    getAllActivities(),
    getRegisteredPlayers(),
    getCurrentUser(),
  ]);

  return <ActivitiesList activities={activities} players={players} isAdmin={user?.role === "admin"} />;
}
