import { getAllActivities, getAllPlayers } from "@/lib/queries";
import { getCurrentUser } from "@/lib/auth";
import ActivitiesList from "@/components/admin/ActivitiesList";

export default async function ActivitiesPage() {
  const [activities, players, user] = await Promise.all([getAllActivities(), getAllPlayers(), getCurrentUser()]);

  return <ActivitiesList activities={activities} players={players} isAdmin={user?.role === "admin"} />;
}
