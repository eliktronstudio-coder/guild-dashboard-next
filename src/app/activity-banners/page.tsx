import { redirect } from "next/navigation";
import { requireAdmin } from "@/lib/auth";
import { getActivityBannerNames } from "@/lib/queries";
import ActivityBannerPanel from "@/components/admin/ActivityBannerPanel";

export default async function ActivityBannersPage() {
  const admin = await requireAdmin();
  if (!admin) redirect("/dashboard");

  const banners = await getActivityBannerNames();

  return <ActivityBannerPanel banners={banners.map((b) => ({
        id: b.id,
        name: b.name,
        isVideo: b.isVideo,
        height: b.height,
        widthPct: b.widthPct,
        imgWidth: b.imgWidth,
        imgHeight: b.imgHeight,
      }))} />;
}
