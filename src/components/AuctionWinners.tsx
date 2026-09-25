import Image from "next/image";
import { Crown, ImageOff, X } from "lucide-react";
import EmptyState from "@/components/EmptyState";

export type Winner = {
  id: string;
  itemName: string;
  itemImageUrl: string | null;
  amount: number;
  winner: string;
  at: string | Date;
};

const numberFmt = new Intl.NumberFormat("ru-RU");
const dateFmt = new Intl.DateTimeFormat("ru-RU", { day: "numeric", month: "short" });

/**
 * Лента «кто что забрал»: квадратные плитки с картинкой лота, именем
 * победителя и ценой.
 *
 * Подпись лежит поверх картинки, а не под ней: так плитка остаётся квадратной
 * при любой длине названия — иначе ряд разъезжался бы по высоте из-за одного
 * длинного имени.
 */
export default function AuctionWinners({
  winners,
  isAdmin = false,
  onDelete,
  busy = false,
}: {
  winners: Winner[];
  isAdmin?: boolean;
  onDelete?: (w: Winner) => void;
  busy?: boolean;
}) {
  return (
    <div>
      <h2 className="mb-2 text-sm font-semibold">Победители и лут</h2>

      {winners.length === 0 ? (
        <div className="rounded-lg border border-border bg-surface">
          <EmptyState
            title="Пока никто ничего не забрал"
            hint="Здесь появятся разыгранные лоты с именами победителей."
          />
        </div>
      ) : (
        <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
          {winners.map((w) => (
            <li
              key={w.id}
              className="group relative aspect-square overflow-hidden rounded-lg border border-border bg-surface-2"
            >
              {w.itemImageUrl ? (
                <Image
                  src={w.itemImageUrl}
                  alt={w.itemName}
                  fill
                  unoptimized
                  className="object-cover transition-transform duration-200 group-hover:scale-105"
                />
              ) : (
                <div className="flex h-full items-center justify-center text-muted">
                  <ImageOff size={22} />
                </div>
              )}

              {/* Затемнение снизу — чтобы подпись читалась на любой картинке. */}
              <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/85 via-black/55 to-transparent p-2.5 pt-8">
                <p className="truncate text-xs font-medium text-white" title={w.itemName}>
                  {w.itemName}
                </p>
                <p className="mt-0.5 flex items-center gap-1 text-[11px] text-white/85">
                  <Crown size={11} className="flex-shrink-0 text-amber-400" />
                  <span className="truncate" title={w.winner}>
                    {w.winner}
                  </span>
                </p>
                <p className="mt-0.5 font-mono text-[11px] tabular-nums text-amber-300">
                  {numberFmt.format(w.amount)}
                </p>
              </div>

              <span className="absolute left-1.5 top-1.5 rounded bg-black/60 px-1.5 py-0.5 text-[10px] text-white/80">
                {dateFmt.format(new Date(w.at))}
              </span>

              {isAdmin && onDelete && (
                <button
                  type="button"
                  onClick={() => onDelete(w)}
                  disabled={busy}
                  title="Удалить лот"
                  aria-label={`Удалить лот «${w.itemName}»`}
                  className="absolute right-1.5 top-1.5 rounded bg-black/60 p-1 text-white/80 transition-colors hover:bg-danger hover:text-white disabled:opacity-50"
                >
                  <X size={12} />
                </button>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
