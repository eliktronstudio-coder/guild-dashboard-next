import Link from "next/link";
import { notFound } from "next/navigation";
import { activities, players } from "@/lib/mock-data";

export default async function ActivityDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const activity = activities.find((a) => String(a.id) === id);
  if (!activity) notFound();

  const roster = players.slice(0, activity.participants % players.length || players.length);

  return (
    <div className="space-y-4">
      <div>
        <Link href="/activities" className="text-xs text-accent hover:underline">
          ← Все активности
        </Link>
      </div>
      <div className="rounded-lg border border-border bg-surface p-4">
        <h2 className="text-lg font-semibold">{activity.name}</h2>
        <p className="mt-1 text-xs text-muted">
          {activity.date} · {activity.participants} участников
        </p>
      </div>
      <div className="rounded-lg border border-border bg-surface">
        <div className="border-b border-border p-4">
          <h3 className="text-sm font-semibold">Состав участников</h3>
        </div>
        <ul className="divide-y divide-border">
          {roster.map((p) => (
            <li key={p.id} className="flex items-center justify-between px-4 py-3 text-sm">
              <span className="font-medium">{p.name}</span>
              <span className="text-xs text-muted">{p.role}</span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
