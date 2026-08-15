"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { Plus, Trash2, X, ImageOff } from "lucide-react";
import clsx from "clsx";

const numberFmt = new Intl.NumberFormat("ru-RU");

type Drop = {
  id: string;
  item: string;
  value: number;
  quantity: number;
  status: string;
  date: string;
  activityName: string | null;
  playerName: string | null;
  imageUrl: string | null;
};

type ActivityOption = { id: string; name: string };
type PlayerOption = { id: string; name: string };
type CatalogItem = { id: string; name: string; price: number; imageUrl: string | null };

function todayISO() {
  return new Date().toISOString().slice(0, 10);
}

export default function DropsPanel({
  drops,
  activities,
  players,
  catalog,
  isAdmin,
}: {
  drops: Drop[];
  activities: ActivityOption[];
  players: PlayerOption[];
  catalog: CatalogItem[];
  isAdmin: boolean;
}) {
  const router = useRouter();
  const [adding, setAdding] = useState(false);
  const [catalogId, setCatalogId] = useState("");
  const [item, setItem] = useState("");
  const [value, setValue] = useState("");
  const [quantity, setQuantity] = useState("1");
  const [date, setDate] = useState(todayISO());
  const [activityId, setActivityId] = useState("");
  const [playerId, setPlayerId] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  function cancel() {
    setAdding(false);
    setCatalogId("");
    setItem("");
    setValue("");
    setQuantity("1");
    setDate(todayISO());
    setActivityId("");
    setPlayerId("");
    setError(null);
  }

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
    setBusyId("new");
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
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Что-то пошло не так.");
        setBusyId(null);
        return;
      }
      cancel();
      router.refresh();
    } catch {
      setError("Не удалось связаться с сервером.");
    } finally {
      setBusyId(null);
    }
  }

  async function handleDelete(id: string) {
    if (!confirm("Удалить запись о дропе?")) return;
    setBusyId(id);
    await fetch(`/api/drops/${id}`, { method: "DELETE" });
    setBusyId(null);
    router.refresh();
  }

  async function handleToggleStatus(id: string, currentStatus: string) {
    const nextStatus = currentStatus === "Продано" ? "Не продано" : "Продано";
    setBusyId(id);
    await fetch(`/api/drops/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: nextStatus }),
    });
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
              <Plus size={16} /> Добавить дроп
            </button>
          )}

          {adding && (
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
                  disabled={busyId === "new"}
                  className="rounded-md bg-accent px-3 py-2 text-sm font-medium text-black hover:opacity-90 disabled:opacity-60"
                >
                  Добавить
                </button>
                <button
                  type="button"
                  onClick={cancel}
                  className="flex items-center gap-1 rounded-md border border-border px-3 py-2 text-sm text-muted hover:text-foreground"
                >
                  <X size={14} /> Отмена
                </button>
              </div>
            </form>
          )}
        </div>
      )}

      <div className="rounded-lg border border-border bg-surface">
        <div className="border-b border-border p-4">
          <h2 className="text-sm font-semibold">Журнал дропа</h2>
        </div>
        <ul className="divide-y divide-border">
          {drops.map((d) => (
            <li key={d.id} className="flex items-center justify-between px-4 py-3 text-sm">
              <span className="flex items-center gap-2">
                {d.imageUrl ? (
                  <Image
                    src={d.imageUrl}
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
                <span className="font-medium">{d.item}</span>
                <span className="text-xs text-muted">
                  ×{d.quantity} · {numberFmt.format(d.value)}/ед.
                </span>
                {(d.activityName || d.playerName) && (
                  <span className="text-xs text-muted">
                    {[d.activityName, d.playerName].filter(Boolean).join(" · ")}
                  </span>
                )}
              </span>
              <span className="flex items-center gap-3">
                <span className="text-accent">{numberFmt.format(d.value * d.quantity)} золота</span>
                <span className="text-xs text-muted">{d.date}</span>
                {isAdmin ? (
                  <button
                    type="button"
                    onClick={() => handleToggleStatus(d.id, d.status)}
                    disabled={busyId === d.id}
                    className={clsx(
                      "rounded-full border px-2 py-0.5 text-[11px] font-medium disabled:opacity-60",
                      d.status === "Продано"
                        ? "border-success/40 text-success hover:bg-success/10"
                        : "border-border text-muted hover:bg-surface-2 hover:text-foreground"
                    )}
                  >
                    {d.status}
                  </button>
                ) : (
                  <span
                    className={clsx(
                      "rounded-full border px-2 py-0.5 text-[11px] font-medium",
                      d.status === "Продано" ? "border-success/40 text-success" : "border-border text-muted"
                    )}
                  >
                    {d.status}
                  </span>
                )}
                {isAdmin && (
                  <button
                    type="button"
                    onClick={() => handleDelete(d.id)}
                    disabled={busyId === d.id}
                    aria-label="Удалить"
                    className="rounded p-1 text-muted hover:bg-surface-2 hover:text-danger disabled:opacity-60"
                  >
                    <Trash2 size={14} />
                  </button>
                )}
              </span>
            </li>
          ))}
          {drops.length === 0 && <li className="px-4 py-6 text-center text-muted">Пока нет записей о дропе.</li>}
        </ul>
      </div>
    </div>
  );
}
