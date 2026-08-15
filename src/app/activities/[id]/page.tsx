import Link from "next/link";
import { notFound } from "next/navigation";
import { getActivityById, getRegisteredPlayers } from "@/lib/queries";
import { getCurrentUser } from "@/lib/auth";
import ActivityDetailPanel from "@/components/admin/ActivityDetailPanel";

export default async function ActivityDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const [activity, user, players] = await Promise.all([
    getActivityById(id),
    getCurrentUser(),
    getRegisteredPlayers(),
  ]);
  if (!activity) notFound();

  return (
    <div className="space-y-4">
      <div>
        <Link href="/activities" className="text-xs text-accent hover:underline">
          ← Все активности
        </Link>
      </div>
      <ActivityDetailPanel
        activity={activity}
        players={players.map((p) => ({ id: p.id, name: p.name, role: p.role }))}
        isAdmin={user?.role === "admin"}
      />
    </div>
  );
}
