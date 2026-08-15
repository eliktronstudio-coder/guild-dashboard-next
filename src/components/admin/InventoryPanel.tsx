type InventoryItem = {
  item: string;
  quantity: number;
  totalValue: number;
};

const numberFmt = new Intl.NumberFormat("ru-RU");

export default function InventoryPanel({ items }: { items: InventoryItem[] }) {
  const totalValue = items.reduce((sum, i) => sum + i.totalValue, 0);

  return (
    <div className="rounded-lg border border-border bg-surface">
      <div className="flex items-center justify-between border-b border-border p-4">
        <h2 className="text-sm font-semibold">Инвентарь</h2>
        <span className="text-xs text-muted">{numberFmt.format(totalValue)} золота нераспределено</span>
      </div>
      <ul className="divide-y divide-border">
        {items.map((i) => (
          <li key={i.item} className="flex items-center justify-between px-4 py-3 text-sm">
            <span className="font-medium">{i.item}</span>
            <span className="flex items-center gap-3">
              <span className="text-xs text-muted">×{i.quantity}</span>
              <span className="text-accent">{numberFmt.format(i.totalValue)} золота</span>
            </span>
          </li>
        ))}
        {items.length === 0 && (
          <li className="px-4 py-6 text-center text-muted">Пока нет нераспределённых предметов.</li>
        )}
      </ul>
    </div>
  );
}
