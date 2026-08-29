import clsx from "clsx";
import Link from "next/link";
import Image from "next/image";
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
  /**
   * Background artwork (dashboard variant only). The image sits on the right and is
   * faded out towards the left by a gradient so the label/value stay readable.
   */
  art?: string;
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
  art,
}: StatCardProps) {
  if (variant === "dashboard") {
    const className = clsx(
      "relative flex min-h-[106px] flex-col gap-3 overflow-hidden rounded-xl border p-4 transition-colors",
      art ? "bg-surface-2" : "bg-surface",
      href ? "hover:border-accent/40" : "hover:border-border-strong",
      strong ? "border-accent/35" : "border-border"
    );
    const content = (
      <>
        {art && (
          <div aria-hidden="true" className="pointer-events-none absolute inset-0">
            <Image src={art} alt="" fill sizes="(max-width: 1280px) 50vw, 25vw" className="object-cover" />
            <div
              className="absolute inset-0"
              style={{
                backgroundImage:
                  "linear-gradient(90deg, rgba(var(--art-scrim),0.97) 0%, rgba(var(--art-scrim),0.85) 45%, rgba(var(--art-scrim),0.2) 75%, rgba(var(--art-scrim),0) 100%)",
              }}
            />
          </div>
        )}
        <div className="relative flex items-center gap-2">
          {Icon && <Icon size={16} strokeWidth={2} className={toneClasses[tone]} />}
          <p className="truncate text-xs font-medium text-muted">{label}</p>
        </div>
        <div className="relative">
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
