"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { Plus, Trash2, X } from "lucide-react";

const numberFmt = new Intl.NumberFormat("ru-RU");

type Drop = {
  id: string;
  item: string;
  value: number;
  date: string;
  activityName: string | null;
  playerName: string | null;
};

type ActivityOption = { id: string; name: string };
type PlayerOption = { id: string; name: string };

function todayISO() {
  return new Date().toISOString().slice(0, 10);
}

export default function DropsPanel({
  drops,
  activities,
  players,
  isAdmin,
}: {
  drops: Drop[];
  activities: ActivityOption[];
  players: PlayerOption[];
  isAdmin: boolean;
}) {
  const router = useRouter();
  const [adding, setAdding] = useState(false);
  const [item, setItem] = useState("");
  const [value, setValue] = useState("");
  const [date, setDate] = useState(todayISO());
  const [activityId, setActivityId] = useState("");
  const [playerId, setPlayerId] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  function cancel() {
    setAdding(false);
    setItem("");
    setValue("");
    setDate(todayISO());
    setActivityId("");
    setPlayerId("");
    setError(null);
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
          date,
          activityId: activityId || null,
          playerId: playerId || null,
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
              className="grid grid-cols-1 gap-3 rounded-lg border border-border bg-surface p-4 sm:grid-cols-2 lg:grid-cols-5"
            >
              <div className="lg:col-span-2">
                <label className="mb-1 block text-xs text-muted">Предмет</label>
                <input
                  value={item}
                  onChange={(e) => setItem(e.target.value)}
                  required
                  maxLength={60}
                  className="w-full rounded-md border border-border bg-surface-2 px-3 py-2 text-sm outline-none focus:border-accent"
                />
              </div>
              <div>
                <label className="mb-1 block text-xs text-muted">Стоимость (золото)</label>
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

              {error && <p className="text-xs text-danger lg:col-span-5">{error}</p>}

              <div className="flex items-center gap-2 lg:col-span-5">
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
              <span>
                <span className="font-medium">{d.item}</span>
                {(d.activityName || d.playerName) && (
                  <span className="ml-2 text-xs text-muted">
                    {[d.activityName, d.playerName].filter(Boolean).join(" · ")}
                  </span>
                )}
              </span>
              <span className="flex items-center gap-3">
                <span className="text-accent">{numberFmt.format(d.value)} золота</span>
                <span className="text-xs text-muted">{d.date}</span>
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
