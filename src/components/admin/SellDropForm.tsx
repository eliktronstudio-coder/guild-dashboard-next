"use client";

import { useState, type FormEvent } from "react";
import { X } from "lucide-react";

const numberFmt = new Intl.NumberFormat("ru-RU");
const AUCTION = "__auction__";

type DropOption = { id: string; item: string; quantity: number; value: number };
type PlayerOption = { id: string; name: string };

export default function SellDropForm({
  drops,
  players,
  onSuccess,
  onCancel,
}: {
  drops: DropOption[];
  players: PlayerOption[];
  onSuccess: () => void;
  onCancel: () => void;
}) {
  const [dropId, setDropId] = useState("");
  const [buyer, setBuyer] = useState("");
  const [amount, setAmount] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const selectedDrop = drops.find((d) => d.id === dropId) ?? null;
  const isAuction = buyer === AUCTION;
  const fixedTotal = selectedDrop ? selectedDrop.value * selectedDrop.quantity : 0;

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    if (!dropId) {
      setError("Выберите предмет из инвентаря.");
      return;
    }
    if (!buyer) {
      setError("Выберите, кому продажа.");
      return;
    }
    setBusy(true);
    try {
      const res = await fetch(`/api/drops/${dropId}/sell`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(isAuction ? { amount: Number(amount) } : { playerId: buyer }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Что-то пошло не так.");
        setBusy(false);
        return;
      }
      onSuccess();
    } catch {
      setError("Не удалось связаться с сервером.");
      setBusy(false);
    }
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="grid grid-cols-1 gap-3 rounded-lg border border-border bg-surface p-4 sm:grid-cols-3"
    >
      <div className="sm:col-span-3">
        <label className="mb-1 block text-xs text-muted">Предмет из инвентаря</label>
        <select
          value={dropId}
          onChange={(e) => setDropId(e.target.value)}
          required
          className="w-full rounded-md border border-border bg-surface-2 px-3 py-2 text-sm outline-none focus:border-accent"
        >
          <option value="">— выбрать —</option>
          {drops.map((d) => (
            <option key={d.id} value={d.id}>
              {d.item} ×{d.quantity} · {numberFmt.format(d.value)}/ед. ({numberFmt.format(d.value * d.quantity)} золота)
            </option>
          ))}
        </select>
        {drops.length === 0 && (
          <p className="mt-1 text-xs text-muted">В инвентаре нет непроданных предметов.</p>
        )}
      </div>

      <div className="sm:col-span-2">
        <label className="mb-1 block text-xs text-muted">Кому продажа</label>
        <select
          value={buyer}
          onChange={(e) => setBuyer(e.target.value)}
          required
          className="w-full rounded-md border border-border bg-surface-2 px-3 py-2 text-sm outline-none focus:border-accent"
        >
          <option value="">— выбрать —</option>
          <option value={AUCTION}>Аукцион</option>
          {players.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ))}
        </select>
      </div>

      <div>
        <label className="mb-1 block text-xs text-muted">Сумма (золото)</label>
        {isAuction ? (
          <input
            type="number"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            min={0}
            required
            placeholder="Введите сумму"
            className="w-full rounded-md border border-border bg-surface-2 px-3 py-2 text-sm outline-none focus:border-accent"
          />
        ) : (
          <div className="flex h-[38px] items-center rounded-md border border-border bg-surface-2 px-3 text-sm text-muted">
            {selectedDrop ? `${numberFmt.format(fixedTotal)} золота` : "—"}
          </div>
        )}
      </div>

      {error && <p className="text-xs text-danger sm:col-span-3">{error}</p>}

      <div className="flex items-center gap-2 sm:col-span-3">
        <button
          type="submit"
          disabled={busy}
          className="rounded-md bg-accent px-3 py-2 text-sm font-medium text-black hover:opacity-90 disabled:opacity-60"
        >
          Продать
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="flex items-center gap-1 rounded-md border border-border px-3 py-2 text-sm text-muted hover:text-foreground"
        >
          <X size={14} /> Отмена
        </button>
      </div>
    </form>
  );
}
