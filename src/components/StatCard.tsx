type StatCardProps = {
  label: string;
  value: string;
  hint: string;
};

export default function StatCard({ label, value, hint }: StatCardProps) {
  return (
    <div className="rounded-lg border border-border bg-surface/90 p-4 backdrop-blur-sm transition-colors hover:border-border-strong hover:bg-surface-hover">
      <p className="text-xs font-medium uppercase tracking-wider text-muted">{label}</p>
      <p className="mt-2 font-mono text-2xl font-semibold tracking-tight tabular-nums text-foreground">{value}</p>
      <p className="mt-1 text-xs text-muted">{hint}</p>
    </div>
  );
}
