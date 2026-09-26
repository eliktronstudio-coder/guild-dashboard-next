import { getCurrentUser } from "@/lib/auth";
import { isFullAdminRole } from "@/lib/accountRoles";
import { prisma } from "@/lib/prisma";
import EmptyState from "@/components/EmptyState";
import AchievementsView, { type RatingRow } from "@/components/achievements/AchievementsView";
import { getAchievementsStartedAt } from "@/lib/achievements/start";
import { buildAchievements, getMetricsForAllPlayers } from "@/lib/achievements/progress";
import { MAX_POINTS_PER_CHAIN } from "@/lib/achievements/tiers";
import { ACHIEVEMENTS } from "@/lib/achievements/catalog";

export default async function AchievementsPage() {
  const user = await getCurrentUser();

  // Как и на аукционе: не выбрасываем на другую страницу молча, а объясняем.
  if (!user || user.role === "random") {
    return (
      <div className="space-y-4">
        <h1 className="text-lg font-semibold">Достижения</h1>
        <div className="rounded-lg border border-border bg-surface">
          <EmptyState
            title={user ? "Доступ ещё не открыт" : "Войдите, чтобы видеть достижения"}
            hint={
              user
                ? "Администратор пока не назначил вашей учётной записи роль в гильдии."
                : "Нажмите «Войти» вверху страницы."
            }
          />
        </div>
      </div>
    );
  }

  const [startedAt, metrics, players, me] = await Promise.all([
    getAchievementsStartedAt(),
    getMetricsForAllPlayers(),
    prisma.player.findMany({ select: { id: true, name: true, role: true } }),
    prisma.player.findUnique({ where: { userId: user.sub }, select: { id: true } }),
  ]);

  const byId = new Map(players.map((p) => [p.id, p]));

  const rating: RatingRow[] = [...metrics.entries()]
    .map(([playerId, m]) => {
      const built = buildAchievements(m, MAX_POINTS_PER_CHAIN);
      const p = byId.get(playerId);
      return {
        playerId,
        name: p?.name ?? "—",
        role: p?.role ?? "—",
        points: built.totalPoints,
        tiers: built.earnedTiers,
      };
    })
    .sort((a, b) => b.points - a.points || b.tiers - a.tiers || a.name.localeCompare(b.name, "ru"));

  const mineBuilt = me ? buildAchievements(metrics.get(me.id) ?? {}, MAX_POINTS_PER_CHAIN) : null;

  // «Все достижения» показываем каталогом без чужого прогресса: это справочник
  // условий, а не чей-то список.
  const catalogOnly = buildAchievements({}, MAX_POINTS_PER_CHAIN);

  return (
    <AchievementsView
      mine={mineBuilt?.items ?? null}
      all={catalogOnly.items}
      rating={rating}
      totals={
        mineBuilt
          ? { points: mineBuilt.totalPoints, tiers: mineBuilt.earnedTiers, maxPoints: mineBuilt.maxPoints }
          : { points: 0, tiers: 0, maxPoints: catalogOnly.maxPoints }
      }
      startedAt={startedAt.toISOString()}
      isAdmin={isFullAdminRole(user.role)}
      meId={me?.id ?? null}
      readyCount={ACHIEVEMENTS.filter((a) => a.source === "ready").length}
    />
  );
}
