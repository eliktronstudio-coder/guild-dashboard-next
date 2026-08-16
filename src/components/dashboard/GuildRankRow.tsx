import clsx from "clsx";
import Link from "next/link";

const roleColor: Record<string, string> = {
  Хил: "#c4aa6a",
  Лучник: "#879c68",
  Маг: "#718ca5",
  Танк: "#7a8fa6",
  Милик: "#b3806a",
};

const rankTier: Record<number, string> = {
  1: "border-[rgba(223,171,77,0.55)]",
  2: "border-[rgba(190,190,190,0.25)]",
  3: "border-[rgba(178,106,51,0.35)]",
};

const rankTextTier: Record<number, string> = {
  1: "text-[#f2bd62]",
};

type GuildRankRowProps = {
  href: string;
  rank: number;
  name: string;
  role: string;
  valueLabel: string;
  valueClassName?: string;
};

export default function GuildRankRow({ href, rank, name, role, valueLabel, valueClassName }: GuildRankRowProps) {
  const color = roleColor[role] ?? "var(--accent-dim)";
  return (
    <Link
      href={href}
      className="group flex min-h-[42px] items-center gap-3 rounded-[7px] border border-white/[0.035] bg-gradient-to-r from-white/[0.026] to-white/[0.012] px-2.5 py-1.5 text-sm transition-[background-color,border-color,transform] duration-150 hover:-translate-y-px hover:border-accent/20 hover:bg-accent-soft"
    >
      <span
        className={clsx(
          "flex h-[30px] w-[30px] flex-shrink-0 items-center justify-center rounded-md border text-xs font-semibold text-muted",
          rankTier[rank] ?? "border-border",
          rankTextTier[rank]
        )}
      >
        {rank}
      </span>
      <span
        className="flex h-[26px] w-[26px] flex-shrink-0 items-center justify-center rounded-full border"
        style={{ borderColor: "rgba(216,160,77,.25)" }}
      >
        <span className="h-2 w-2 rounded-full" style={{ background: color }} />
      </span>
      <span className="min-w-0 flex-1 truncate">
        <span className="text-[13px] font-semibold text-foreground">{name}</span>
        <span className="ml-2 text-[11px] text-muted">{role}</span>
      </span>
      <span className={clsx("flex-shrink-0 text-xs font-medium", valueClassName)}>{valueLabel}</span>
    </Link>
  );
}
