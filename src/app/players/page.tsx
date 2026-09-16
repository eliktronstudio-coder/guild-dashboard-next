import { getAllPlayers, getPlayerPeriodPaidMap } from "@/lib/queries";
import { getCurrentUser } from "@/lib/auth";
import { isFullAdminRole } from "@/lib/accountRoles";
import { getActivePeriodId } from "@/lib/period";
import PlayersTable from "@/components/admin/PlayersTable";

export default async function PlayersPage() {
  const periodId = await getActivePeriodId();
  const [players, user, paidMap] = await Promise.all([getAllPlayers(), getCurrentUser(), getPlayerPeriodPaidMap(periodId)]);

  const withPeriod = players.map((p) => {
    const paidPeriod = paidMap.get(p.id) ?? 0;
    return { ...p, paidPeriod, accruedPeriod: paidPeriod + p.salary };
  });

  return (
    <PlayersTable
      players={withPeriod}
      isAdmin={isFullAdminRole(user?.role)}
      currentUserId={user?.sub ?? null}
      isRandom={user?.role === "random"}
    />
  );
}
