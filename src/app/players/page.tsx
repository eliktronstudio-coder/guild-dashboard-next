import { getAllPlayers, getGuildSettings } from "@/lib/queries";
import { getCurrentUser } from "@/lib/auth";
import PlayersTable from "@/components/admin/PlayersTable";

export default async function PlayersPage() {
  const [players, user, settings] = await Promise.all([getAllPlayers(), getCurrentUser(), getGuildSettings()]);

  return (
    <PlayersTable
      players={players}
      isAdmin={user?.role === "admin"}
      currentUserId={user?.sub ?? null}
      salarySettings={{ salaryGsTier1: settings.salaryGsTier1, salaryGsTier2: settings.salaryGsTier2 }}
    />
  );
}
