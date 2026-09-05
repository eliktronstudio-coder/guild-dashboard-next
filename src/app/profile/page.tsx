import { redirect } from "next/navigation";
import {
  getPlayerByUserId,
  getPlayerActivityHistory,
  getPlayerPayments,
  getPlayerDailyAttendance,
} from "@/lib/queries";
import { getCurrentUser } from "@/lib/auth";
import PlayerProfileView from "@/components/players/PlayerProfileView";
import EmptyState from "@/components/EmptyState";

export default async function MyProfilePage() {
  const user = await getCurrentUser();
  if (!user) redirect("/dashboard");

  const player = await getPlayerByUserId(user.sub);
  if (!player) {
    return (
      <div className="rounded-lg border border-border bg-surface">
        <EmptyState
          title="Аккаунт не привязан к игроку"
          hint="Попросите админа привязать ваш аккаунт к игроку в составе гильдии."
        />
      </div>
    );
  }

  const [activities, payments, dailyAttendance] = await Promise.all([
    getPlayerActivityHistory(player.id, 20),
    getPlayerPayments(player.id, 20),
    getPlayerDailyAttendance(player.id, 30),
  ]);
  const isRandom = user.role === "random";

  return (
    <PlayerProfileView
      player={player}
      activities={activities}
      payments={payments}
      dailyAttendance={dailyAttendance}
      isRandom={isRandom}
    />
  );
}
