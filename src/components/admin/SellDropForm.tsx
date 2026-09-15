"use client";

import { useState, type FormEvent } from "react";
import { X } from "lucide-react";
import AutocompleteInput from "./AutocompleteInput";

const numberFmt = new Intl.NumberFormat("ru-RU");
const AUCTION = "__auction__";
const JUNK = "__junk__";
const MINI_RB = "__mini_rb__";

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
  const [note, setNote] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const isJunk = item === JUNK;
  const isMiniRb = item === MINI_RB;
  // Продажа Мини-РБ и мусор не берутся из инвентаря: предмета нет, сумму
  // вводит администратор.
  const isFreeform = isJunk || isMiniRb;
  const selectedDrop = isFreeform ? null : (drops.find((d) => d.item === item) ?? null);
  const isAuction = buyer === AUCTION;
  const fixedTotal = selectedDrop ? proportionalTotal(selectedDrop.entries, qty) : 0;
  const showManualAmount = isAuction || isFreeform;
  // У продажи Мини-РБ покупателя нет: это общий доход гильдии, а не выкуп
  // предмета игроком. Поэтому поле «Кому продажа» скрыто.
  const showBuyer = !isMiniRb;

  function handleItemChange(value: string) {
    setItem(value);
    if (value === JUNK || value === MINI_RB) {
      setQty(1);
      return;
    }
    const d = drops.find((x) => x.item === value);
    setQty(d ? d.quantity : 1);
  }

  function handleQtyChange(value: string) {
    const n = Math.round(Number(value));
    if (!Number.isFinite(n)) return;
    if (isFreeform) {
      setQty(Math.max(1, n));
      return;
    }
    const max = selectedDrop?.quantity ?? 1;
    setQty(Math.min(max, Math.max(1, n)));
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    if (!isFreeform && !selectedDrop) {
      setError("Выберите предмет из инвентаря.");
      return;
    }
    if (!isFreeform && selectedDrop && (qty < 1 || qty > selectedDrop.quantity)) {
      setError("Некорректное количество.");
      return;
    }
    if (isMiniRb && qty < 1) {
      setError("Укажите количество РБ опыта.");
      return;
    }
    if (isFreeform && (qty < 1 || !amount || !Number.isFinite(Number(amount)) || Number(amount) < 0)) {
      setError("Укажите количество и сумму продажи.");
      return;
    }
    if (showBuyer && !buyer) {
      setError("Выберите, кому продажа.");
      return;
    }
    const itemLabel = isJunk ? "Мусор" : isMiniRb ? "Продажа Мини-РБ" : (selectedDrop?.item ?? "");
    const buyerLabel = isAuction ? "аукцион" : (players.find((p) => p.id === buyer)?.name ?? buyer);
    const totalLabel = showManualAmount ? (amount ? `${numberFmt.format(Number(amount))} золота` : "сумма не указана") : `${numberFmt.format(fixedTotal)} золота`;
    const confirmText = isMiniRb
      ? `Провести продажу Мини-РБ: ${numberFmt.format(qty)} опыта, ${totalLabel}? Вся сумма пойдёт в Мини-РБ.`
      : `Продать ×${qty} «${itemLabel}» — ${buyerLabel}, ${totalLabel}?`;
    if (!confirm(confirmText)) {
      return;
    }
    setBusy(true);
    try {
      const res = await fetch("/api/drops/sell", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(
          isMiniRb
            ? { miniRb: true, xp: qty, amount: Number(amount), note }
            : isJunk
            ? { junk: true, quantity: qty, amount: Number(amount), ...(isAuction ? {} : { playerId: buyer }) }
            : {
                entryIds: selectedDrop!.entries.map((en) => en.id),
                quantity: qty,
                ...(isAuction ? { amount: Number(amount) } : { playerId: buyer }),
              }
        ),
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
        <AutocompleteInput
          value={item}
          onChange={handleItemChange}
          options={[
            { value: MINI_RB, label: "Продажа Мини-РБ" },
            { value: JUNK, label: "Мусор" },
            ...drops.map((d) => ({ value: d.item, label: d.item })),
          ]}
          pinnedValues={[MINI_RB, JUNK]}
          placeholder="Поиск по дропу…"
        />
        {drops.length === 0 && (
          <p className="mt-1 text-xs text-muted">В Инвентаре ХД нет непроданных предметов.</p>
        )}
      </div>

      <div>
        <label className="mb-1 block text-xs text-muted">
          {isMiniRb ? "Количество РБ опыта" : "Количество"}
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
          max={isFreeform ? undefined : (selectedDrop?.quantity ?? 1)}
          disabled={!selectedDrop && !isFreeform}
          required
          className="w-full rounded-md border border-border bg-surface-2 px-3 py-2 text-sm outline-none focus:border-accent disabled:opacity-60"
        />
      </div>

      {showBuyer && (
        <div>
          <label className="mb-1 block text-xs text-muted">Кому продажа</label>
          <AutocompleteInput
            value={buyer}
            onChange={setBuyer}
            options={[{ value: AUCTION, label: "Аукцион" }, ...players.map((p) => ({ value: p.id, label: p.name }))]}
            pinnedValues={[AUCTION]}
            placeholder="Поиск по нику…"
          />
        </div>
      )}

      <div>
        <label className="mb-1 block text-xs text-muted">Сумма (золото)</label>
        {showManualAmount ? (
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

      {isMiniRb && (
        <div className="sm:col-span-3">
          <label className="mb-1 block text-xs text-muted">
            Примечание <span className="text-muted-2">(необязательно, попадёт в описание операции)</span>
          </label>
          <input
            value={note}
            onChange={(e) => setNote(e.target.value)}
            maxLength={120}
            placeholder="Например: Кракен, продажа эссенций"
            className="w-full rounded-md border border-border bg-surface-2 px-3 py-2 text-sm outline-none focus:border-accent"
          />
          <p className="mt-1 text-xs text-accent">
            Вся сумма пойдёт в «Казну мини-РБ» — резерв гильдии с неё не удерживается.
          </p>
        </div>
      )}

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
