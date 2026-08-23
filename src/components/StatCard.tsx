import clsx from "clsx";
import Link from "next/link";
import type { ComponentType } from "react";

type Tone = "accent" | "violet" | "ember" | "info" | "accent-dim" | "red";

const toneClasses: Record<Tone, string> = {
  accent: "text-accent-bright",
  violet: "text-violet",
  ember: "text-ember",
  info: "text-info",
  "accent-dim": "text-accent-dim",
  red: "text-red-bright",
};

type StatIcon = ComponentType<{ size?: number; strokeWidth?: number; className?: string }>;

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
      "flex min-h-[106px] flex-col gap-3 rounded-xl border bg-surface p-4 transition-colors",
      href ? "hover:border-accent/40" : "hover:border-border-strong",
      strong ? "border-accent/35" : "border-border"
    );
    const content = (
      <>
        <div className="flex items-center gap-2">
          {Icon && <Icon size={16} strokeWidth={2} className={toneClasses[tone]} />}
          <p className="truncate text-xs font-medium text-muted">{label}</p>
        </div>
        <div>
          <p className="flex items-baseline gap-1.5 font-heading text-[22px] font-bold tracking-tight tabular-nums text-foreground">
            {value}
            {goldValue && <span aria-hidden="true" className="inline-block h-2.5 w-2.5 rounded-full bg-accent" />}
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
        {Icon && <Icon size={15} strokeWidth={2} className={toneClasses[tone]} />}
        <p className="truncate text-xs font-medium uppercase tracking-wider text-muted">{label}</p>
      </div>
      <p className="mt-2 font-heading text-2xl font-bold tracking-tight tabular-nums text-foreground">{value}</p>
      <p className="mt-1 text-xs text-muted">{hint}</p>
    </div>
  );
}
