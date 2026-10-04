import { notFound } from "next/navigation";
import {
  getPlayerById,
  getPlayerActivityHistory,
  getPlayerPayments,
  getPlayerDailyAttendance,
  getActivityBannerNames,
} from "@/lib/queries";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { findLabelMatch } from "@/lib/nameMatch";
import { enrichBuildsWithSummary } from "@/lib/dollBuild";
import PlayerProfileView from "@/components/players/PlayerProfileView";
import ProfileAchievements from "@/components/achievements/ProfileAchievements";
import SavedBuilds from "@/components/players/SavedBuilds";
import { buildAchievements, getMetricsForPlayer } from "@/lib/achievements/progress";
import { MAX_POINTS_PER_CHAIN } from "@/lib/achievements/tiers";

export default async function PlayerDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const [player, activities, payments, dailyAttendance, user, bannerNames, rawBuilds] = await Promise.all([
    getPlayerById(id),
    getPlayerActivityHistory(id, 100),
    getPlayerPayments(id, 20),
    getPlayerDailyAttendance(id, 30),
    getCurrentUser(),
    getActivityBannerNames(),
    prisma.savedBuild.findMany({ where: { playerId: id }, orderBy: { createdAt: "desc" } }),
  ]);
  const activitiesWithBanners = activities.map((a) => {
    const banner = findLabelMatch(a.name, bannerNames);
    return { ...a, bannerId: banner?.id ?? null, bannerIsVideo: banner?.isVideo ?? false };
  });
  const builds = await enrichBuildsWithSummary(rawBuilds.map((b) => ({ ...b, createdAt: b.createdAt.toISOString() })));
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
      {!isRandom && (
        <SavedBuilds playerId={id} builds={builds} canEdit={!!user && player.userId === user.sub} />
      )}
    </div>
  );
}
