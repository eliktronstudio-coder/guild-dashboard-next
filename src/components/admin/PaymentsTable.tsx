"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { Plus, Trash2, X } from "lucide-react";

const numberFmt = new Intl.NumberFormat("ru-RU");
const STATUSES = ["Выплачено", "Ожидает", "Отклонено"];

const statusColor: Record<string, string> = {
  Выплачено: "text-success",
  Ожидает: "text-accent",
  Отклонено: "text-danger",
};

type Payment = {
  id: string;
  player: { id: string; name: string };
  amount: number;
  status: string;
  date: string;
};

type PlayerOption = { id: string; name: string };

function todayISO() {
  return new Date().toISOString().slice(0, 10);
}

export default function PaymentsTable({
  payments,
  players,
  isAdmin,
}: {
  payments: Payment[];
  players: PlayerOption[];
  isAdmin: boolean;
}) {
  const router = useRouter();
  const [adding, setAdding] = useState(false);
  const [playerId, setPlayerId] = useState(players[0]?.id ?? "");
  const [amount, setAmount] = useState("");
  const [status, setStatus] = useState(STATUSES[1]);
  const [date, setDate] = useState(todayISO());
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setBusyId("new");
    try {
      const res = await fetch("/api/payments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ playerId, amount: Number(amount), status, date }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Что-то пошло не так.");
        setBusyId(null);
        return;
      }
      setAdding(false);
      setAmount("");
      setDate(todayISO());
      router.refresh();
    } catch {
      setError("Не удалось связаться с сервером.");
    } finally {
      setBusyId(null);
    }
  }

  async function handleStatusChange(id: string, newStatus: string) {
    setBusyId(id);
    await fetch(`/api/payments/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: newStatus }),
    });
    setBusyId(null);
    router.refresh();
  }

  async function handleDelete(id: string) {
    if (!confirm("Удалить выплату?")) return;
    setBusyId(id);
    await fetch(`/api/payments/${id}`, { method: "DELETE" });
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
              <Plus size={16} /> Добавить выплату
            </button>
          )}

          {adding && (
            <form
              onSubmit={handleSubmit}
              className="grid grid-cols-1 gap-3 rounded-lg border border-border bg-surface p-4 sm:grid-cols-4"
            >
              <div>
                <label className="mb-1 block text-xs text-muted">Игрок</label>
                <select
                  value={playerId}
                  onChange={(e) => setPlayerId(e.target.value)}
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
                <label className="mb-1 block text-xs text-muted">Сумма</label>
                <input
                  type="number"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  min={1}
                  required
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
                <label className="mb-1 block text-xs text-muted">Дата</label>
                <input
                  type="date"
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
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

      <div className="overflow-x-auto rounded-lg border border-border bg-surface">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border text-left text-xs uppercase tracking-wider text-muted">
              <th className="px-4 py-3 font-medium">Игрок</th>
              <th className="px-4 py-3 font-medium">Сумма</th>
              <th className="px-4 py-3 font-medium">Статус</th>
              <th className="px-4 py-3 font-medium">Дата</th>
              {isAdmin && <th className="px-4 py-3 font-medium" />}
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {payments.map((p) => (
              <tr key={p.id} className="hover:bg-surface-2">
                <td className="px-4 py-3 font-medium">{p.player.name}</td>
                <td className="px-4 py-3">{numberFmt.format(p.amount)} золота</td>
                <td className="px-4 py-3">
                  {isAdmin ? (
                    <select
                      value={p.status}
                      disabled={busyId === p.id}
                      onChange={(e) => handleStatusChange(p.id, e.target.value)}
                      className={`rounded-md border border-border bg-surface-2 px-2 py-1 text-sm outline-none focus:border-accent disabled:opacity-60 ${statusColor[p.status]}`}
                    >
                      {STATUSES.map((s) => (
                        <option key={s} value={s}>
                          {s}
                        </option>
                      ))}
                    </select>
                  ) : (
                    <span className={statusColor[p.status]}>{p.status}</span>
                  )}
                </td>
                <td className="px-4 py-3 text-muted">{p.date}</td>
                {isAdmin && (
                  <td className="px-4 py-3">
                    <button
                      type="button"
                      onClick={() => handleDelete(p.id)}
                      disabled={busyId === p.id}
                      aria-label="Удалить"
                      className="rounded p-1.5 text-muted hover:bg-surface-2 hover:text-danger disabled:opacity-60"
                    >
                      <Trash2 size={15} />
                    </button>
                  </td>
                )}
              </tr>
            ))}
            {payments.length === 0 && (
              <tr>
                <td colSpan={isAdmin ? 5 : 4} className="px-4 py-6 text-center text-muted">
                  Пока нет выплат.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
