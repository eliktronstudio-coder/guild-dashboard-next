import { redirect } from "next/navigation";
import { requireAdmin } from "@/lib/auth";
import { getActivityBanners } from "@/lib/queries";
import ActivityBannerPanel from "@/components/admin/ActivityBannerPanel";

export default async function ActivityBannersPage() {
  const admin = await requireAdmin();
  if (!admin) redirect("/dashboard");

  const banners = await getActivityBanners();

  return <ActivityBannerPanel banners={banners.map((b) => ({ id: b.id, name: b.name, imageUrl: b.imageUrl, height: b.height, widthPct: b.widthPct }))} />;
}
