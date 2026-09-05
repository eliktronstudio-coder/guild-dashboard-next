import { notFound } from "next/navigation";
import { getPlayerById, getPlayerActivityHistory, getPlayerPayments, getPlayerDailyAttendance } from "@/lib/queries";
import { getCurrentUser } from "@/lib/auth";
import PlayerProfileView from "@/components/players/PlayerProfileView";

export default async function PlayerDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const [player, activities, payments, dailyAttendance, user] = await Promise.all([
    getPlayerById(id),
    getPlayerActivityHistory(id, 20),
    getPlayerPayments(id, 20),
    getPlayerDailyAttendance(id, 30),
    getCurrentUser(),
  ]);
  if (!player) notFound();
  const isRandom = user?.role === "random";

  return (
    <PlayerProfileView
      player={player}
      activities={activities}
      payments={payments}
      dailyAttendance={dailyAttendance}
      isRandom={isRandom}
      backHref="/players"
      backLabel="← Состав"
    />
  );
}
