import Link from "next/link";
import { notFound } from "next/navigation";
import { players } from "@/lib/mock-data";
import StatCard from "@/components/StatCard";

const numberFmt = new Intl.NumberFormat("ru-RU");

export default async function PlayerDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const player = players.find((p) => String(p.id) === id);
  if (!player) notFound();

  return (
    <div className="space-y-4">
      <div>
        <Link href="/players" className="text-xs text-accent hover:underline">
          ← Состав
        </Link>
      </div>
      <div className="rounded-lg border border-border bg-surface p-4">
        <h2 className="text-lg font-semibold">{player.name}</h2>
        <p className="mt-1 text-xs text-muted">{player.role}</p>
      </div>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <StatCard label="Уровень" value={String(player.level)} hint="текущий уровень" />
        <StatCard label="Опыт" value={`${numberFmt.format(player.xp)} XP`} hint="накоплено" />
        <StatCard label="Посещаемость" value={`${player.attendancePct}%`} hint="за 30 дней" />
      </div>
    </div>
  );
}
