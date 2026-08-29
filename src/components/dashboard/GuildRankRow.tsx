import clsx from "clsx";
import Link from "next/link";

const roleColor: Record<string, string> = {
  Хил: "#c4aa6a",
  Лучник: "#879c68",
  Маг: "#718ca5",
  Танк: "#7a8fa6",
  Милик: "#b3806a",
};

type GuildRankRowProps = {
  href: string;
  rank: number;
  name: string;
  role: string;
  valueLabel: string;
  valueClassName?: string;
  /** 0-100; when set, renders an accent fill behind the row proportional to this value. */
  progressPct?: number;
};

export default function GuildRankRow({
  href,
  rank,
  name,
  role,
  valueLabel,
  valueClassName,
  progressPct,
}: GuildRankRowProps) {
  const color = roleColor[role] ?? "var(--accent-dim)";
  const pct = typeof progressPct === "number" ? Math.max(0, Math.min(100, progressPct)) : undefined;
  return (
    <Link
      href={href}
      className="group relative flex min-h-[46px] items-center justify-between gap-3 overflow-hidden rounded-lg border border-border bg-transparent px-4 py-2.5 text-sm transition-colors duration-150 hover:border-accent/30"
    >
      {pct !== undefined && (
        <div
          aria-hidden="true"
          className="absolute inset-y-0 left-0"
          style={{
            width: `${pct}%`,
            backgroundImage: "linear-gradient(90deg, rgba(255,158,44,0.18), rgba(255,158,44,0.04) 90%)",
          }}
        />
      )}
      <span className="relative flex items-center gap-3 truncate">
        <span className="font-heading text-sm font-bold text-accent">{rank}</span>
        <span
          className="flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full border"
          style={{ borderColor: "rgba(255,158,44,.25)" }}
        >
          <span className="h-2 w-2 rounded-full" style={{ background: color }} />
        </span>
        <span className="min-w-0 truncate">
          <span className="text-[14px] font-semibold text-foreground">{name}</span>
          <span className="ml-2 text-[11px] text-muted-2">{role}</span>
        </span>
      </span>
      <span className={clsx("relative flex-shrink-0 font-heading text-sm font-semibold", valueClassName ?? "text-accent")}>
        {valueLabel}
      </span>
    </Link>
  );
}
