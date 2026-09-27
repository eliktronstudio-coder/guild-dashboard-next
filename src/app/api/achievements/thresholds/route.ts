import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { getMetricsForAllPlayers, buildAchievements } from "@/lib/achievements/progress";
import { MAX_POINTS_PER_CHAIN, DEFAULT_TIERS } from "@/lib/achievements/tiers";
import { getTierThresholds, setTierThresholds, buildTiersFromThresholds } from "@/lib/achievements/thresholds";

export async function GET() {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: "Нет доступа." }, { status: 403 });

  const thresholds = await getTierThresholds();
  return NextResponse.json({ thresholds, defaults: DEFAULT_TIERS.map((t) => t.threshold) });
}

/**
 * Считает превью «что изменится» для набора порогов, не сохраняя их: сколько
 * очков всего наберётся у гильдии при новых порогах против текущих — иначе
 * админ менял бы пороги вслепую.
 */
export async function POST(request: NextRequest) {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: "Нет доступа." }, { status: 403 });

  const body = await request.json().catch(() => null);
  const thresholds = Array.isArray(body?.thresholds) ? body.thresholds.map(Number) : null;
  const apply = body?.apply === true;
  if (!thresholds) return NextResponse.json({ error: "Нужен массив из 6 порогов." }, { status: 400 });

  const [currentThresholds, metrics] = await Promise.all([getTierThresholds(), getMetricsForAllPlayers()]);
  const currentTiers = buildTiersFromThresholds(currentThresholds);
  const proposedTiers = buildTiersFromThresholds(thresholds);

  let currentPoints = 0;
  let currentTierCount = 0;
  let proposedPoints = 0;
  let proposedTierCount = 0;
  for (const m of metrics.values()) {
    const before = buildAchievements(m, MAX_POINTS_PER_CHAIN, currentTiers);
    currentPoints += before.totalPoints;
    currentTierCount += before.earnedTiers;
    const after = buildAchievements(m, MAX_POINTS_PER_CHAIN, proposedTiers);
    proposedPoints += after.totalPoints;
    proposedTierCount += after.earnedTiers;
  }

  if (apply) {
    const result = await setTierThresholds(thresholds);
    if (!result.ok) return NextResponse.json({ error: result.error }, { status: 400 });
  }

  return NextResponse.json({
    applied: apply,
    preview: {
      currentPoints,
      currentTierCount,
      proposedPoints,
      proposedTierCount,
      pointsDelta: proposedPoints - currentPoints,
      tierCountDelta: proposedTierCount - currentTierCount,
      players: metrics.size,
    },
  });
}
