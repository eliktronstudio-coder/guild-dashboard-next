import clsx from "clsx";
import type { LucideIcon } from "lucide-react";

type Tone = "accent" | "violet" | "ember" | "info" | "accent-dim";

const toneClasses: Record<Tone, string> = {
  accent: "bg-accent-soft text-accent-bright",
  violet: "bg-violet/15 text-violet",
  ember: "bg-ember/15 text-ember",
  info: "bg-info/15 text-info",
  "accent-dim": "bg-accent-dim/15 text-accent-dim",
};

type StatCardProps = {
  label: string;
  value: string;
  hint: string;
  icon?: LucideIcon;
  tone?: Tone;
};

export default function StatCard({ label, value, hint, icon: Icon, tone = "accent" }: StatCardProps) {
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
