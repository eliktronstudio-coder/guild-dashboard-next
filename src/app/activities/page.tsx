import Link from "next/link";
import { activities } from "@/lib/mock-data";

export default function ActivitiesPage() {
  return (
    <div className="rounded-lg border border-border bg-surface">
      <div className="border-b border-border p-4">
        <h2 className="text-sm font-semibold">Все активности</h2>
      </div>
      <ul className="divide-y divide-border">
        {activities.map((a) => (
          <li key={a.id}>
            <Link
              href={`/activities/${a.id}`}
              className="flex items-center justify-between px-4 py-3 text-sm hover:bg-surface-2"
            >
              <span>
                <span className="font-medium">{a.name}</span>
                <span className="ml-2 text-xs text-muted">{a.participants} участников</span>
              </span>
              <span className="text-xs text-muted">{a.date}</span>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
