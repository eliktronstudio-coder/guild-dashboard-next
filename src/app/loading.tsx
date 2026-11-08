export default function Loading() {
  return (
    <div role="status" aria-label="Загрузка" className="space-y-4">
      <p className="text-sm text-muted">Загружаем данные гильдии…</p>
      {[1, 2, 3].map((i) => (
        <div
          key={i}
          className="h-24 rounded-xl border border-border bg-surface motion-safe:animate-pulse"
        />
      ))}
    </div>
  );
}
