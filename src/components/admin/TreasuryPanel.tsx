"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { Plus, Trash2, ImageOff } from "lucide-react";
import SellDropForm from "./SellDropForm";

const numberFmt = new Intl.NumberFormat("ru-RU");

type Transaction = {
  id: string;
  description: string;
  amount: number;
  date: string;
  imageUrl: string | null;
};

type DropOption = { id: string; item: string; quantity: number; value: number };
type PlayerOption = { id: string; name: string };

export default function TreasuryPanel({
  transactions,
  drops,
  players,
  isAdmin,
}: {
  transactions: Transaction[];
  drops: DropOption[];
  players: PlayerOption[];
  isAdmin: boolean;
}) {
  const router = useRouter();
  const [adding, setAdding] = useState(false);
  const [busy, setBusy] = useState(false);

  async function handleDelete(id: string) {
    if (!confirm("Удалить операцию?")) return;
    setBusy(true);
    await fetch(`/api/treasury/transactions/${id}`, { method: "DELETE" });
    setBusy(false);
    router.refresh();
  }

  if (!isAdmin) {
    return (
      <div className="rounded-lg border border-border bg-surface">
        <div className="border-b border-border p-4">
          <h2 className="text-sm font-semibold">Последняя продажа</h2>
        </div>
        <TransactionList transactions={transactions} />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {!adding && (
        <button
          type="button"
          onClick={() => setAdding(true)}
          className="flex items-center gap-2 rounded-md bg-accent px-3 py-2 text-sm font-medium text-black hover:opacity-90"
        >
          <Plus size={16} /> Добавить продажу
        </button>
      )}

      {adding && (
        <SellDropForm
          drops={drops}
          players={players}
          onSuccess={() => {
            setAdding(false);
            router.refresh();
          }}
          onCancel={() => setAdding(false)}
        />
      )}

      <div className="rounded-lg border border-border bg-surface">
        <div className="border-b border-border p-4">
          <h2 className="text-sm font-semibold">Последняя продажа</h2>
        </div>
        <TransactionList transactions={transactions} onDelete={handleDelete} busy={busy} />
      </div>
    </div>
  );
}

function TransactionList({
  transactions,
  onDelete,
  busy,
}: {
  transactions: Transaction[];
  onDelete?: (id: string) => void;
  busy?: boolean;
}) {
  return (
    <ul className="divide-y divide-border">
      {transactions.map((t) => (
        <li key={t.id} className="flex items-center justify-between gap-3 px-4 py-3 text-sm">
          <span className="flex min-w-0 items-center gap-2">
            {t.imageUrl ? (
              <Image
                src={t.imageUrl}
                alt=""
                width={24}
                height={24}
                unoptimized
                className="h-6 w-6 flex-shrink-0 rounded border border-border object-cover"
              />
            ) : (
              <div className="flex h-6 w-6 flex-shrink-0 items-center justify-center rounded border border-border bg-surface-2 text-muted">
                <ImageOff size={10} />
              </div>
            )}
            <span className="truncate">{t.description}</span>
          </span>
          <span className="flex flex-shrink-0 items-center gap-3">
            <span className={t.amount >= 0 ? "text-success" : "text-danger"}>
              {t.amount >= 0 ? "+" : ""}
              {numberFmt.format(t.amount)}
            </span>
            <span className="text-xs text-muted">{t.date}</span>
            {onDelete && (
              <button
                type="button"
                onClick={() => onDelete(t.id)}
                disabled={busy}
                aria-label="Удалить"
                className="rounded p-1 text-muted hover:bg-surface-2 hover:text-danger disabled:opacity-60"
              >
                <Trash2 size={14} />
              </button>
            )}
          </span>
        </li>
      ))}
      {transactions.length === 0 && (
        <li className="px-4 py-6 text-center text-muted">Пока нет операций.</li>
      )}
    </ul>
  );
}
