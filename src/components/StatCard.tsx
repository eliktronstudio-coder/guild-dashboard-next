type StatCardProps = {
  label: string;
  value: string;
  hint: string;
};

export default function StatCard({ label, value, hint }: StatCardProps) {
  return (
    <div className="relative rounded-lg border border-border bg-surface p-4 before:absolute before:left-1.5 before:top-1.5 before:h-1.5 before:w-1.5 before:border-l before:border-t before:border-accent-dim before:content-[''] after:absolute after:bottom-1.5 after:right-1.5 after:h-1.5 after:w-1.5 after:border-b after:border-r after:border-accent-dim after:content-['']">
      <p className="text-xs font-medium uppercase tracking-wider text-muted">{label}</p>
      <p className="mt-2 font-mono text-2xl font-semibold tracking-tight tabular-nums">{value}</p>
      <p className="mt-1 text-xs text-muted">{hint}</p>
    </div>
  );
}
