import Link from "next/link";
import { notFound } from "next/navigation";
import { getActivityById, getRegisteredPlayers, getDropCatalog, getActivityBannerNames } from "@/lib/queries";
import { findLabelMatch } from "@/lib/nameMatch";
import { getCurrentUser } from "@/lib/auth";
import { canManageActivitiesRole, isFullAdminRole } from "@/lib/accountRoles";
import ActivityDetailPanel from "@/components/admin/ActivityDetailPanel";
import BlurGate from "@/components/BlurGate";

export default async function ActivityDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const [activity, user, players, catalog, bannerNames] = await Promise.all([
    getActivityById(id),
    getCurrentUser(),
    getRegisteredPlayers(),
    getDropCatalog(),
    getActivityBannerNames(),
  ]);
  if (!activity) notFound();

  const banner = findLabelMatch(activity.name, bannerNames);

  return (
    <div className="space-y-4">
      <div>
        <Link href="/activities" className="text-xs text-accent hover:underline">
          ← Все активности
        </Link>
      </div>
      <BlurGate blurred={user?.role === "random"}>
        <ActivityDetailPanel
          activity={activity}
          players={players.map((p) => ({ id: p.id, name: p.name, role: p.role }))}
          catalog={catalog.map((c) => ({ id: c.id, name: c.name, price: c.price, imageUrl: c.imageUrl }))}
          isAdmin={canManageActivitiesRole(user?.role)}
          canManageDrops={isFullAdminRole(user?.role)}
          bannerUrl={banner ? `/api/activity-banners/${banner.id}/media` : null}
          bannerIsVideo={banner?.isVideo ?? false}
          bannerHeight={banner?.height ?? null}
          bannerWidthPct={banner?.widthPct ?? undefined}
          bannerRatio={banner?.imgWidth && banner?.imgHeight ? `${banner.imgWidth} / ${banner.imgHeight}` : null}
        />
      </BlurGate>
    </div>
  );
}
