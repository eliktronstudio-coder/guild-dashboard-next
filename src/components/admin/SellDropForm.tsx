"use client";

import { useState, type FormEvent } from "react";
import { X } from "lucide-react";

const numberFmt = new Intl.NumberFormat("ru-RU");
const AUCTION = "__auction__";

type DropEntry = { id: string; quantity: number; value: number };
type DropOption = { item: string; quantity: number; totalValue: number; entries: DropEntry[] };
type PlayerOption = { id: string; name: string };

// Считает стоимость первых qty единиц предмета, "снимая" их по очереди
// с записей дропа (как их выдаёт сервер — от новых к старым). Должно
// совпадать с тем, как /api/drops/sell фактически распределяет продажу
// по записям, иначе показанная сумма разъедется с реально списанной.
function proportionalTotal(entries: DropEntry[], qty: number): number {
  let remaining = qty;
  let total = 0;
  for (const e of entries) {
    if (remaining <= 0) break;
    const take = Math.min(remaining, e.quantity);
    total += take * e.value;
    remaining -= take;
  }
  return total;
}

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
  const [item, setItem] = useState("");
  const [qty, setQty] = useState(1);
  const [buyer, setBuyer] = useState("");
  const [amount, setAmount] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const selectedDrop = drops.find((d) => d.item === item) ?? null;
  const isAuction = buyer === AUCTION;
  const fixedTotal = selectedDrop ? proportionalTotal(selectedDrop.entries, qty) : 0;

  function handleItemChange(value: string) {
    setItem(value);
    const d = drops.find((x) => x.item === value);
    setQty(d ? d.quantity : 1);
  }

  function handleQtyChange(value: string) {
    const max = selectedDrop?.quantity ?? 1;
    const n = Math.round(Number(value));
    if (!Number.isFinite(n)) return;
    setQty(Math.min(max, Math.max(1, n)));
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    if (!selectedDrop) {
      setError("Выберите предмет из инвентаря.");
      return;
    }
    if (qty < 1 || qty > selectedDrop.quantity) {
      setError("Некорректное количество.");
      return;
    }
    if (!buyer) {
      setError("Выберите, кому продажа.");
      return;
    }
    const buyerLabel = isAuction ? "аукцион" : (players.find((p) => p.id === buyer)?.name ?? buyer);
    const totalLabel = isAuction ? (amount ? `${numberFmt.format(Number(amount))} золота` : "сумма не указана") : `${numberFmt.format(fixedTotal)} золота`;
    if (!confirm(`Продать ×${qty} «${selectedDrop.item}» — ${buyerLabel}, ${totalLabel}?`)) {
      return;
    }
    setBusy(true);
    try {
      const res = await fetch("/api/drops/sell", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          entryIds: selectedDrop.entries.map((en) => en.id),
          quantity: qty,
          ...(isAuction ? { amount: Number(amount) } : { playerId: buyer }),
        }),
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
        <label className="mb-1 block text-xs text-muted">Предмет из Инвентаря ХД</label>
        <select
          value={item}
          onChange={(e) => handleItemChange(e.target.value)}
          required
          className="w-full rounded-md border border-border bg-surface-2 px-3 py-2 text-sm outline-none focus:border-accent"
        >
          <option value="">— выбрать —</option>
          {drops.map((d) => (
            <option key={d.item} value={d.item}>
              {d.item}
            </option>
          ))}
        </select>
        {drops.length === 0 && (
          <p className="mt-1 text-xs text-muted">В Инвентаре ХД нет непроданных предметов.</p>
        )}
      </div>

      <div>
        <label className="mb-1 block text-xs text-muted">
          Количество
          {selectedDrop && (
            <span className="text-muted-2">
              {" "}
              (доступно {selectedDrop.quantity}, записей: {selectedDrop.entries.length})
            </span>
          )}
        </label>
        <input
          type="number"
          value={qty}
          onChange={(e) => handleQtyChange(e.target.value)}
          min={1}
          max={selectedDrop?.quantity ?? 1}
          disabled={!selectedDrop}
          required
          className="w-full rounded-md border border-border bg-surface-2 px-3 py-2 text-sm outline-none focus:border-accent disabled:opacity-60"
        />
      </div>

      <div>
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
