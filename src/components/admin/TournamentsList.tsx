"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { Plus, Trash2, X } from "lucide-react";

const STATUSES = ["Регистрация", "Идёт", "Завершён"];

const statusColor: Record<string, string> = {
  Идёт: "text-accent",
  Регистрация: "text-success",
  Завершён: "text-muted",
};

type Tournament = {
  id: string;
  name: string;
  status: string;
  teams: number;
  dateLabel: string;
};

function todayISO() {
  return new Date().toISOString().slice(0, 10);
}

export default function TournamentsList({
  tournaments,
  isAdmin,
}: {
  tournaments: Tournament[];
  isAdmin: boolean;
}) {
  const router = useRouter();
  const [adding, setAdding] = useState(false);
  const [name, setName] = useState("");
  const [status, setStatus] = useState(STATUSES[0]);
  const [teams, setTeams] = useState("0");
  const [startDate, setStartDate] = useState(todayISO());
  const [endDate, setEndDate] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setBusyId("new");
    try {
      const res = await fetch("/api/tournaments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, status, teams: Number(teams), startDate, endDate: endDate || null }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Что-то пошло не так.");
        setBusyId(null);
        return;
      }
      setAdding(false);
      setName("");
      setTeams("0");
      setStartDate(todayISO());
      setEndDate("");
      router.refresh();
    } catch {
      setError("Не удалось связаться с сервером.");
    } finally {
      setBusyId(null);
    }
  }

  async function handleStatusChange(id: string, newStatus: string) {
    setBusyId(id);
    await fetch(`/api/tournaments/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: newStatus }),
    });
    setBusyId(null);
    router.refresh();
  }

  async function handleDelete(id: string) {
    if (!confirm("Удалить турнир?")) return;
    setBusyId(id);
    await fetch(`/api/tournaments/${id}`, { method: "DELETE" });
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
              <Plus size={16} /> Добавить турнир
            </button>
          )}

          {adding && (
            <form
              onSubmit={handleSubmit}
              className="grid grid-cols-1 gap-3 rounded-lg border border-border bg-surface p-4 sm:grid-cols-5"
            >
              <div className="sm:col-span-2">
                <label className="mb-1 block text-xs text-muted">Название</label>
                <input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  required
                  maxLength={60}
                  className="w-full rounded-md border border-border bg-surface-2 px-3 py-2 text-sm outline-none focus:border-accent"
                />
              </div>
              <div>
                <label className="mb-1 block text-xs text-muted">Статус</label>
                <select
                  value={status}
                  onChange={(e) => setStatus(e.target.value)}
                  className="w-full rounded-md border border-border bg-surface-2 px-3 py-2 text-sm outline-none focus:border-accent"
                >
                  {STATUSES.map((s) => (
                    <option key={s} value={s}>
                      {s}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="mb-1 block text-xs text-muted">Команд</label>
                <input
                  type="number"
                  value={teams}
                  onChange={(e) => setTeams(e.target.value)}
                  min={0}
                  required
                  className="w-full rounded-md border border-border bg-surface-2 px-3 py-2 text-sm outline-none focus:border-accent"
                />
              </div>
              <div>
                <label className="mb-1 block text-xs text-muted">Начало</label>
                <input
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  required
                  className="w-full rounded-md border border-border bg-surface-2 px-3 py-2 text-sm outline-none focus:border-accent"
                />
              </div>
              <div>
                <label className="mb-1 block text-xs text-muted">Конец (необязательно)</label>
                <input
                  type="date"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  className="w-full rounded-md border border-border bg-surface-2 px-3 py-2 text-sm outline-none focus:border-accent"
                />
              </div>

              {error && <p className="text-xs text-danger sm:col-span-5">{error}</p>}

              <div className="flex items-center gap-2 sm:col-span-5">
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

      <div className="space-y-3">
        {tournaments.map((t) => (
          <div
            key={t.id}
            className="flex items-center justify-between rounded-lg border border-border bg-surface p-4"
          >
            <div>
              <p className="text-sm font-medium">{t.name}</p>
              <p className="mt-1 text-xs text-muted">
                {t.teams} команд · {t.dateLabel}
              </p>
            </div>
            <div className="flex items-center gap-3">
              {isAdmin ? (
                <select
                  value={t.status}
                  disabled={busyId === t.id}
                  onChange={(e) => handleStatusChange(t.id, e.target.value)}
                  className={`rounded-md border border-border bg-surface-2 px-2 py-1 text-xs outline-none focus:border-accent disabled:opacity-60 ${statusColor[t.status]}`}
                >
                  {STATUSES.map((s) => (
                    <option key={s} value={s}>
                      {s}
                    </option>
                  ))}
                </select>
              ) : (
                <span className={`text-xs font-medium ${statusColor[t.status]}`}>{t.status}</span>
              )}
              {isAdmin && (
                <button
                  type="button"
                  onClick={() => handleDelete(t.id)}
                  disabled={busyId === t.id}
                  aria-label="Удалить"
                  className="rounded p-1.5 text-muted hover:bg-surface-2 hover:text-danger disabled:opacity-60"
                >
                  <Trash2 size={15} />
                </button>
              )}
            </div>
          </div>
        ))}
        {tournaments.length === 0 && <p className="text-sm text-muted">Пока нет турниров.</p>}
      </div>
    </div>
  );
}
