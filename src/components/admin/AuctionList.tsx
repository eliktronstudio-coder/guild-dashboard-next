"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { Plus, Trash2, X } from "lucide-react";

const numberFmt = new Intl.NumberFormat("ru-RU");

type Lot = {
  id: string;
  item: string;
  seller: { id: string; name: string };
  price: number;
  endsAt: string;
};

type PlayerOption = { id: string; name: string };

function formatTimeLeft(endsAt: string) {
  const diff = new Date(endsAt).getTime() - Date.now();
  if (diff <= 0) return "завершён";
  const hours = Math.floor(diff / (1000 * 60 * 60));
  const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
  return `${hours} ч ${String(minutes).padStart(2, "0")} мин`;
}

function defaultEndsAt() {
  const d = new Date(Date.now() + 24 * 60 * 60 * 1000);
  return d.toISOString().slice(0, 16);
}

export default function AuctionList({
  lots,
  players,
  isAdmin,
}: {
  lots: Lot[];
  players: PlayerOption[];
  isAdmin: boolean;
}) {
  const router = useRouter();
  const [adding, setAdding] = useState(false);
  const [item, setItem] = useState("");
  const [sellerId, setSellerId] = useState(players[0]?.id ?? "");
  const [price, setPrice] = useState("");
  const [endsAt, setEndsAt] = useState(defaultEndsAt());
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setBusyId("new");
    try {
      const res = await fetch("/api/auction", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ item, sellerId, price: Number(price), endsAt }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Что-то пошло не так.");
        setBusyId(null);
        return;
      }
      setAdding(false);
      setItem("");
      setPrice("");
      setEndsAt(defaultEndsAt());
      router.refresh();
    } catch {
      setError("Не удалось связаться с сервером.");
    } finally {
      setBusyId(null);
    }
  }

  async function handleDelete(id: string) {
    if (!confirm("Удалить лот?")) return;
    setBusyId(id);
    await fetch(`/api/auction/${id}`, { method: "DELETE" });
    setBusyId(null);
    router.refresh();
  }

  return (
    <div className="space-y-4">
      {isAdmin && (
        <div>
          {!adding && (
            <button
              type="button"
              onClick={() => setAdding(true)}
              className="flex items-center gap-2 rounded-md bg-accent px-3 py-2 text-sm font-medium text-black hover:opacity-90"
            >
              <Plus size={16} /> Добавить лот
            </button>
          )}

          {adding && (
            <form
              onSubmit={handleSubmit}
              className="grid grid-cols-1 gap-3 rounded-lg border border-border bg-surface p-4 sm:grid-cols-4"
            >
              <div className="sm:col-span-2">
                <label className="mb-1 block text-xs text-muted">Название лота</label>
                <input
                  value={item}
                  onChange={(e) => setItem(e.target.value)}
                  required
                  maxLength={60}
                  className="w-full rounded-md border border-border bg-surface-2 px-3 py-2 text-sm outline-none focus:border-accent"
                />
              </div>
              <div>
                <label className="mb-1 block text-xs text-muted">Продавец</label>
                <select
                  value={sellerId}
                  onChange={(e) => setSellerId(e.target.value)}
                  required
                  className="w-full rounded-md border border-border bg-surface-2 px-3 py-2 text-sm outline-none focus:border-accent"
                >
                  {players.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="mb-1 block text-xs text-muted">Цена</label>
                <input
                  type="number"
                  value={price}
                  onChange={(e) => setPrice(e.target.value)}
                  min={1}
                  required
                  className="w-full rounded-md border border-border bg-surface-2 px-3 py-2 text-sm outline-none focus:border-accent"
                />
              </div>
              <div className="sm:col-span-2">
                <label className="mb-1 block text-xs text-muted">Окончание</label>
                <input
                  type="datetime-local"
                  value={endsAt}
                  onChange={(e) => setEndsAt(e.target.value)}
                  required
                  className="w-full rounded-md border border-border bg-surface-2 px-3 py-2 text-sm outline-none focus:border-accent"
                />
              </div>

              {error && <p className="text-xs text-danger sm:col-span-4">{error}</p>}

              <div className="flex items-center gap-2 sm:col-span-4">
                <button
                  type="submit"
                  disabled={busyId === "new"}
                  className="rounded-md bg-accent px-3 py-2 text-sm font-medium text-black hover:opacity-90 disabled:opacity-60"
                >
                  Добавить
                </button>
                <button
                  type="button"
                  onClick={() => setAdding(false)}
                  className="flex items-center gap-1 rounded-md border border-border px-3 py-2 text-sm text-muted hover:text-foreground"
                >
                  <X size={14} /> Отмена
                </button>
              </div>
            </form>
          )}
        </div>
      )}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {lots.map((lot) => (
          <div key={lot.id} className="rounded-lg border border-border bg-surface p-4">
            <div className="flex items-start justify-between">
              <p className="text-sm font-medium">{lot.item}</p>
              {isAdmin && (
                <button
                  type="button"
                  onClick={() => handleDelete(lot.id)}
                  disabled={busyId === lot.id}
                  aria-label="Удалить"
                  className="rounded p-1 text-muted hover:bg-surface-2 hover:text-danger disabled:opacity-60"
                >
                  <Trash2 size={14} />
                </button>
              )}
            </div>
            <p className="mt-1 text-xs text-muted">Продавец: {lot.seller.name}</p>
            <div className="mt-4 flex items-center justify-between">
              <span className="text-lg font-semibold text-accent">{numberFmt.format(lot.price)}</span>
              <span className="text-xs text-muted">до конца: {formatTimeLeft(lot.endsAt)}</span>
            </div>
          </div>
        ))}
        {lots.length === 0 && <p className="text-sm text-muted">Пока нет активных лотов.</p>}
      </div>
    </div>
  );
}
