import { notFound } from "next/navigation";
import {
  getPlayerById,
  getPlayerActivityHistory,
  getPlayerPayments,
  getPlayerDailyAttendance,
  getActivityBannerNames,
} from "@/lib/queries";
import { getCurrentUser } from "@/lib/auth";
import { findLabelMatch } from "@/lib/nameMatch";
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
  const [player, activities, payments, dailyAttendance, user, bannerNames] = await Promise.all([
    getPlayerById(id),
    getPlayerActivityHistory(id, 100),
    getPlayerPayments(id, 20),
    getPlayerDailyAttendance(id, 30),
    getCurrentUser(),
    getActivityBannerNames(),
  ]);
  const activitiesWithBanners = activities.map((a) => {
    const banner = findLabelMatch(a.name, bannerNames);
    return { ...a, bannerId: banner?.id ?? null, bannerIsVideo: banner?.isVideo ?? false };
  });
  const ach = buildAchievements(await getMetricsForPlayer(id), MAX_POINTS_PER_CHAIN);
  if (!player) notFound();
  const isRandom = user?.role === "random";
  let pinnedKeys: string[] | null = null;
  try {
    pinnedKeys = player.pinnedAchievements ? (JSON.parse(player.pinnedAchievements) as string[]) : null;
  } catch {
    pinnedKeys = null;
  }

  return (
    <div className="space-y-4">
      <PlayerProfileView
      player={player}
      activities={activitiesWithBanners}
      payments={payments}
      dailyAttendance={dailyAttendance}
      isRandom={isRandom}
      backHref="/players"
      backLabel="← Состав"
      />
      {!isRandom && (
        <ProfileAchievements
          playerId={id}
          items={ach.items}
          totalPoints={ach.totalPoints}
          earnedTiers={ach.earnedTiers}
          maxPoints={ach.maxPoints}
          pinnedKeys={pinnedKeys}
          canEdit={!!user && player.userId === user.sub}
        />
      )}
    </div>
  );
}
