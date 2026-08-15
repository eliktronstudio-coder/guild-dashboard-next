import clsx from "clsx";

type Tone = "accent" | "success" | "danger" | "muted" | "info";

const toneClass: Record<Tone, string> = {
  accent: "border-accent/40 bg-accent-soft text-accent-bright",
  success: "border-success/40 bg-success/10 text-success",
  danger: "border-danger/40 bg-danger/10 text-danger",
  muted: "border-border bg-surface-2 text-muted",
  info: "border-info/40 bg-info/10 text-info",
};

export default function StatusBadge({ label, tone }: { label: string; tone: Tone }) {
  return (
    <span
      className={clsx(
        "inline-flex items-center gap-1.5 rounded-md border px-2 py-0.5 text-xs font-medium",
        toneClass[tone]
      )}
    >
      <span className="h-1.5 w-1.5 rounded-full bg-current" aria-hidden="true" />
      {label}
    </span>
  );
}
