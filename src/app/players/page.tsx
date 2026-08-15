import { getAllPlayers } from "@/lib/queries";
import { getCurrentUser } from "@/lib/auth";
import PlayersTable from "@/components/admin/PlayersTable";

export default async function PlayersPage() {
  const [players, user] = await Promise.all([getAllPlayers(), getCurrentUser()]);

  return <PlayersTable players={players} isAdmin={user?.role === "admin"} currentUserId={user?.sub ?? null} />;
}
