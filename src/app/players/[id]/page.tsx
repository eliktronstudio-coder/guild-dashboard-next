import { notFound } from "next/navigation";
import { getPlayerById, getPlayerActivityHistory, getPlayerPayments, getPlayerDailyAttendance } from "@/lib/queries";
import { getCurrentUser } from "@/lib/auth";
import PlayerProfileView from "@/components/players/PlayerProfileView";
import ProfileAchievements from "@/components/achievements/ProfileAchievements";
import { buildAchievements, getMetricsForPlayer } from "@/lib/achievements/progress";
import { MAX_POINTS_PER_CHAIN } from "@/lib/achievements/tiers";

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
  const ach = buildAchievements(await getMetricsForPlayer(id), MAX_POINTS_PER_CHAIN);
  if (!player) notFound();
  const isRandom = user?.role === "random";

  return (
    <div className="space-y-4">
      <PlayerProfileView
      player={player}
      activities={activities}
      payments={payments}
      dailyAttendance={dailyAttendance}
      isRandom={isRandom}
      backHref="/players"
      backLabel="← Состав"
      />
      {!isRandom && (
        <ProfileAchievements
          items={ach.items}
          totalPoints={ach.totalPoints}
          earnedTiers={ach.earnedTiers}
          maxPoints={ach.maxPoints}
        />
      )}
    </div>
  );
}
