import { auctionLots } from "@/lib/mock-data";

const numberFmt = new Intl.NumberFormat("ru-RU");

export default function AuctionPage() {
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
      {auctionLots.map((lot) => (
        <div key={lot.id} className="rounded-lg border border-border bg-surface p-4">
          <p className="text-sm font-medium">{lot.item}</p>
          <p className="mt-1 text-xs text-muted">Продавец: {lot.seller}</p>
          <div className="mt-4 flex items-center justify-between">
            <span className="text-lg font-semibold text-accent">{numberFmt.format(lot.price)}</span>
            <span className="text-xs text-muted">до конца: {lot.endsIn}</span>
          </div>
        </div>
      ))}
    </div>
  );
}
