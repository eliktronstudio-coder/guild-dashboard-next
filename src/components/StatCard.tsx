import clsx from "clsx";
import Link from "next/link";
import type { ComponentType } from "react";
import JapaneseWavePattern from "./dashboard/JapaneseWavePattern";

type Tone = "accent" | "violet" | "ember" | "info" | "accent-dim" | "red";

const toneClasses: Record<Tone, string> = {
  accent: "bg-accent-soft text-accent-bright",
  violet: "bg-violet/15 text-violet",
  ember: "bg-ember/15 text-ember",
  info: "bg-info/15 text-info",
  "accent-dim": "bg-accent-dim/15 text-accent-dim",
  red: "bg-red-bright/10 text-red-bright",
};

type StatIcon = ComponentType<{ size?: number; strokeWidth?: number }>;

type StatCardProps = {
  label: string;
  value: string;
  hint: string;
  icon?: StatIcon;
  tone?: Tone;
  /** "dashboard" opts into the denser Japanese-styled KPI treatment; other pages keep the plain look by default. */
  variant?: "default" | "dashboard";
  strong?: boolean;
  goldValue?: boolean;
  /** When set (dashboard variant only), the card renders as a link to this path. */
  href?: string;
};

export default function StatCard({
  label,
  value,
  hint,
  icon: Icon,
  tone = "accent",
  variant = "default",
  strong = false,
  goldValue = false,
  href,
}: StatCardProps) {
  if (variant === "dashboard") {
    const className = clsx(
      "relative flex min-h-[106px] flex-col justify-between overflow-hidden rounded-lg border bg-gradient-to-br from-[rgba(18,26,38,0.97)] to-[rgba(10,16,25,0.98)] p-4 transition-colors",
      href ? "hover:border-accent/60" : "hover:border-border-strong",
      strong
        ? "border-accent/45 shadow-[inset_0_1px_0_rgba(255,255,255,0.025),0_0_24px_rgba(216,160,77,0.035)]"
        : "border-[rgba(209,155,72,0.22)]"
    );
    const content = (
      <>
        <JapaneseWavePattern className="text-accent" opacity={0.045} />
        <div className="relative flex items-center gap-2.5">
          {Icon && (
            <span
              className={clsx(
                "flex h-[34px] w-[34px] flex-shrink-0 items-center justify-center rounded-full border border-current/25",
                toneClasses[tone]
              )}
            >
              <Icon size={15} strokeWidth={2.25} />
            </span>
          )}
          <p className="truncate text-[11px] font-medium uppercase tracking-[0.035em] text-muted">{label}</p>
        </div>
        <div className="relative">
          <p
            className={clsx(
              "mt-2 font-mono text-[21px] font-semibold tracking-tight tabular-nums",
              goldValue ? "text-accent-bright" : "text-foreground"
            )}
          >
            {value}
          </p>
          <p className="mt-1 text-[11px] text-muted-2">{hint}</p>
        </div>
      </>
    );
    return href ? (
      <Link href={href} className={className}>
        {content}
      </Link>
    ) : (
      <div className={className}>{content}</div>
    );
  }

  return (
    <div className="rounded-lg border border-border bg-surface/90 p-4 backdrop-blur-sm transition-colors hover:border-border-strong hover:bg-surface-hover">
      <div className="flex items-center gap-2">
        {Icon && (
          <span className={clsx("flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-md", toneClasses[tone])}>
            <Icon size={14} strokeWidth={2.25} />
          </span>
        )}
        <p className="truncate text-xs font-medium uppercase tracking-wider text-muted">{label}</p>
      </div>
      <p className="mt-2 font-mono text-2xl font-semibold tracking-tight tabular-nums text-foreground">{value}</p>
      <p className="mt-1 text-xs text-muted">{hint}</p>
    </div>
  );
}
