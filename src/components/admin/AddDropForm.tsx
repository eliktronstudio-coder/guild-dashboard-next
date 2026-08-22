"use client";

import { useState, type FormEvent } from "react";
import { X } from "lucide-react";

const numberFmt = new Intl.NumberFormat("ru-RU");

function todayISO() {
  return new Date().toISOString().slice(0, 10);
}

type ActivityOption = { id: string; name: string };
type PlayerOption = { id: string; name: string };
type CatalogItem = { id: string; name: string; price: number };

export default function AddDropForm({
  activities,
  players,
  catalog,
  forceWarehouse,
  showCategoryPicker = false,
  onSuccess,
  onCancel,
}: {
  activities: ActivityOption[];
  players: PlayerOption[];
  catalog: CatalogItem[];
  /** Принудительно записать дроп на этот склад (в обход авто-маршрута по активности). */
  forceWarehouse?: string;
  /** Показать выбор категории (Прайм/Мини-РБ) — для добавления сразу на склад ХД. */
  showCategoryPicker?: boolean;
  onSuccess: () => void;
  onCancel: () => void;
}) {
  const [catalogId, setCatalogId] = useState("");
  const [item, setItem] = useState("");
  const [value, setValue] = useState("");
  const [quantity, setQuantity] = useState("1");
  const [date, setDate] = useState(todayISO());
  const [activityId, setActivityId] = useState("");
  const [playerId, setPlayerId] = useState("");
  const [category, setCategory] = useState("Прайм");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  function handleCatalogSelect(id: string) {
    setCatalogId(id);
    const found = catalog.find((c) => c.id === id);
    if (found) {
      setItem(found.name);
      setValue(String(found.price));
    }
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      const res = await fetch("/api/drops", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          item,
          value: Number(value),
          quantity: Number(quantity),
          date,
          activityId: activityId || null,
          playerId: playerId || null,
          catalogItemId: catalogId || null,
          ...(forceWarehouse ? { warehouse: forceWarehouse } : {}),
          ...(showCategoryPicker ? { category } : {}),
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
      className="grid grid-cols-1 gap-3 rounded-lg border border-border bg-surface p-4 sm:grid-cols-2 lg:grid-cols-6"
    >
      <div className="sm:col-span-2 lg:col-span-6">
        <label className="mb-1 block text-xs text-muted">Из реестра дропа</label>
        <select
          value={catalogId}
          onChange={(e) => handleCatalogSelect(e.target.value)}
          className="w-full rounded-md border border-border bg-surface-2 px-3 py-2 text-sm outline-none focus:border-accent"
        >
          <option value="">— выбрать или ввести вручную ниже —</option>
          {catalog.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name} · {numberFmt.format(c.price)}/ед.
            </option>
          ))}
        </select>
      </div>
      <div className="lg:col-span-2">
        <label className="mb-1 block text-xs text-muted">Предмет</label>
        <input
          value={item}
          onChange={(e) => {
            setItem(e.target.value);
            setCatalogId("");
          }}
          required
          maxLength={60}
          className="w-full rounded-md border border-border bg-surface-2 px-3 py-2 text-sm outline-none focus:border-accent"
        />
      </div>
      <div>
        <label className="mb-1 block text-xs text-muted">Кол-во</label>
        <input
          type="number"
          value={quantity}
          onChange={(e) => setQuantity(e.target.value)}
          min={1}
          required
          className="w-full rounded-md border border-border bg-surface-2 px-3 py-2 text-sm outline-none focus:border-accent"
        />
      </div>
      <div>
        <label className="mb-1 block text-xs text-muted">Цена за ед. (золото)</label>
        <input
          type="number"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          min={0}
          required
          className="w-full rounded-md border border-border bg-surface-2 px-3 py-2 text-sm outline-none focus:border-accent"
        />
      </div>
      <div>
        <label className="mb-1 block text-xs text-muted">Дата</label>
        <input
          type="date"
          value={date}
          onChange={(e) => setDate(e.target.value)}
          required
          className="w-full rounded-md border border-border bg-surface-2 px-3 py-2 text-sm outline-none focus:border-accent"
        />
      </div>
      {showCategoryPicker && (
        <div>
          <label className="mb-1 block text-xs text-muted">Категория</label>
          <select
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            className="w-full rounded-md border border-border bg-surface-2 px-3 py-2 text-sm outline-none focus:border-accent"
          >
            <option value="Прайм">Прайм</option>
            <option value="Мини-РБ">Мини-РБ</option>
          </select>
        </div>
      )}
      <div>
        <label className="mb-1 block text-xs text-muted">Активность</label>
        <select
          value={activityId}
          onChange={(e) => setActivityId(e.target.value)}
          className="w-full rounded-md border border-border bg-surface-2 px-3 py-2 text-sm outline-none focus:border-accent"
        >
          <option value="">—</option>
          {activities.map((a) => (
            <option key={a.id} value={a.id}>
              {a.name}
            </option>
          ))}
        </select>
      </div>
      <div>
        <label className="mb-1 block text-xs text-muted">Получил</label>
        <select
          value={playerId}
          onChange={(e) => setPlayerId(e.target.value)}
          className="w-full rounded-md border border-border bg-surface-2 px-3 py-2 text-sm outline-none focus:border-accent"
        >
          <option value="">—</option>
          {players.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ))}
        </select>
      </div>

      {error && <p className="text-xs text-danger lg:col-span-6">{error}</p>}

      <div className="flex items-center gap-2 lg:col-span-6">
        <button
          type="submit"
          disabled={busy}
          className="rounded-md bg-accent px-3 py-2 text-sm font-medium text-black hover:opacity-90 disabled:opacity-60"
        >
          Добавить
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
