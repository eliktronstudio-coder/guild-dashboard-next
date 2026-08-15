"use client";

import { useState, type FormEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Plus, Trash2, X, Search } from "lucide-react";

type Activity = {
  id: string;
  name: string;
  date: string;
  participants: number;
};

type PlayerOption = { id: string; name: string; role: string };

function todayISO() {
  return new Date().toISOString().slice(0, 10);
}

export default function ActivitiesList({
  activities,
  players,
  isAdmin,
}: {
  activities: Activity[];
  players: PlayerOption[];
  isAdmin: boolean;
}) {
  const router = useRouter();
  const [adding, setAdding] = useState(false);
  const [name, setName] = useState("");
  const [date, setDate] = useState(todayISO());
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [search, setSearch] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const knownActivityNames = [...new Set(activities.map((a) => a.name))];
  const filteredPlayers = players.filter((p) => p.name.toLowerCase().includes(search.trim().toLowerCase()));

  function toggleSelected(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function cancel() {
    setAdding(false);
    setName("");
    setDate(todayISO());
    setSelected(new Set());
    setSearch("");
    setError(null);
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      const res = await fetch("/api/activities", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, date, participantIds: [...selected] }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Что-то пошло не так.");
        setBusy(false);
        return;
      }
      cancel();
      router.refresh();
    } catch {
      setError("Не удалось связаться с сервером.");
    } finally {
      setBusy(false);
    }
  }

  async function handleDelete(id: string) {
    if (!confirm("Удалить активность?")) return;
    setBusy(true);
    await fetch(`/api/activities/${id}`, { method: "DELETE" });
    setBusy(false);
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
              <Plus size={16} /> Добавить активность
            </button>
          )}

          {adding && (
            <form onSubmit={handleSubmit} className="space-y-3 rounded-lg border border-border bg-surface p-4">
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div>
                  <label className="mb-1 block text-xs text-muted">Название</label>
                  <input
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    required
                    maxLength={60}
                    list="activity-name-options"
                    placeholder="Выберите или введите новое"
                    className="w-full rounded-md border border-border bg-surface-2 px-3 py-2 text-sm outline-none focus:border-accent"
                  />
                  <datalist id="activity-name-options">
                    {knownActivityNames.map((n) => (
                      <option key={n} value={n} />
                    ))}
                  </datalist>
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
              </div>

              <div>
                <p className="mb-1.5 text-xs text-muted">
                  Состав <span className="text-muted/70">(только зарегистрированные на сайте)</span>
                </p>
                <div className="relative mb-2">
                  <Search size={14} className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-muted" />
                  <input
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    placeholder="Поиск по нику…"
                    className="w-full rounded-md border border-border bg-surface-2 py-2 pl-8 pr-3 text-sm outline-none focus:border-accent"
                  />
                </div>
                <div className="flex max-h-52 flex-wrap gap-2 overflow-y-auto rounded-md border border-border bg-surface-2 p-2">
                  {players.length === 0 && (
                    <p className="text-xs text-muted">
                      Пока никто из состава не зарегистрирован на сайте — участников добавить нельзя.
                    </p>
                  )}
                  {players.length > 0 && filteredPlayers.length === 0 && (
                    <p className="text-xs text-muted">Никого не найдено.</p>
                  )}
                  {filteredPlayers.map((p) => (
                    <label
                      key={p.id}
                      className="flex cursor-pointer items-center gap-1.5 rounded-md border border-border bg-surface px-2 py-1 text-xs"
                    >
                      <input
                        type="checkbox"
                        checked={selected.has(p.id)}
                        onChange={() => toggleSelected(p.id)}
                        className="accent-accent"
                      />
                      {p.name} <span className="text-muted">· {p.role}</span>
                    </label>
                  ))}
                </div>
                {selected.size > 0 && (
                  <p className="mt-1.5 text-xs text-muted">Выбрано: {selected.size}</p>
                )}
              </div>

              {error && <p className="text-xs text-danger">{error}</p>}

              <div className="flex items-center gap-2">
                <button
                  type="submit"
                  disabled={busy}
                  className="rounded-md bg-accent px-3 py-2 text-sm font-medium text-black hover:opacity-90 disabled:opacity-60"
                >
                  Создать
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
          <h2 className="text-sm font-semibold">Все активности</h2>
        </div>
        <ul className="divide-y divide-border">
          {activities.map((a) => (
            <li key={a.id} className="flex items-center justify-between px-4 py-3 text-sm hover:bg-surface-2">
              <Link href={`/activities/${a.id}`} className="flex-1">
                <span className="font-medium">{a.name}</span>
                <span className="ml-2 text-xs text-muted">{a.participants} участников</span>
              </Link>
              <span className="text-xs text-muted">{a.date}</span>
              {isAdmin && (
                <button
                  type="button"
                  onClick={() => handleDelete(a.id)}
                  aria-label="Удалить"
                  className="ml-3 rounded p-1.5 text-muted hover:bg-surface-2 hover:text-danger"
                >
                  <Trash2 size={15} />
                </button>
              )}
            </li>
          ))}
          {activities.length === 0 && <li className="px-4 py-6 text-center text-muted">Пока нет активностей.</li>}
        </ul>
      </div>
    </div>
  );
}
