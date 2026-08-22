"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { Archive, Pencil, Plus, Trash2, X } from "lucide-react";
import Modal from "@/components/Modal";
import EmptyState from "@/components/EmptyState";
import StatusBadge from "@/components/StatusBadge";
import BlurValue from "@/components/BlurValue";

const numberFmt = new Intl.NumberFormat("ru-RU");
const STATUSES = ["Ожидает", "Подтверждено", "Выплачено"];

const statusTone: Record<string, "accent" | "success" | "danger"> = {
  Ожидает: "accent",
  Подтверждено: "accent",
  Выплачено: "success",
  Отклонено: "danger",
};

type Payment = {
  id: string;
  player: { id: string; name: string };
  amount: number;
  status: string;
  date: string;
  dateISO: string;
  source: string;
};

type PlayerOption = { id: string; name: string };

function todayISO() {
  return new Date().toISOString().slice(0, 10);
}

export default function PaymentsTable({
  payments,
  players,
  isAdmin,
  isRandom = false,
}: {
  payments: Payment[];
  players: PlayerOption[];
  isAdmin: boolean;
  isRandom?: boolean;
}) {
  const router = useRouter();
  const [adding, setAdding] = useState(false);
  const [playerId, setPlayerId] = useState(players[0]?.id ?? "");
  const [amount, setAmount] = useState("");
  const [status, setStatus] = useState(STATUSES[0]);
  const [date, setDate] = useState(todayISO());
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [editing, setEditing] = useState<Payment | null>(null);
  const [editAmount, setEditAmount] = useState("");
  const [editStatus, setEditStatus] = useState(STATUSES[0]);
  const [editDate, setEditDate] = useState("");
  const [editError, setEditError] = useState<string | null>(null);
  const [archiving, setArchiving] = useState(false);
  const [archiveMessage, setArchiveMessage] = useState<string | null>(null);

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

  async function confirmDelete() {
    if (!confirmDeleteId) return;
    const id = confirmDeleteId;
    setBusyId(id);
    await fetch(`/api/payments/${id}`, { method: "DELETE" });
    setBusyId(null);
    setConfirmDeleteId(null);
    router.refresh();
  }

  function openEdit(p: Payment) {
    setEditing(p);
    setEditAmount(String(p.amount));
    setEditStatus(p.status);
    setEditDate(p.dateISO);
    setEditError(null);
  }

  async function handleEditSubmit(e: FormEvent) {
    e.preventDefault();
    if (!editing) return;
    setEditError(null);
    setBusyId(editing.id);
    try {
      const res = await fetch(`/api/payments/${editing.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ amount: Number(editAmount), status: editStatus, date: editDate }),
      });
      const data = await res.json();
      if (!res.ok) {
        setEditError(data.error ?? "Что-то пошло не так.");
        return;
      }
      setEditing(null);
      router.refresh();
    } catch {
      setEditError("Не удалось связаться с сервером.");
    } finally {
      setBusyId(null);
    }
  }

  async function handleArchive() {
    setArchiving(true);
    setArchiveMessage(null);
    try {
      const res = await fetch("/api/payments/archive", { method: "POST" });
      const data = await res.json();
      if (!res.ok) {
        setArchiveMessage(data.error ?? "Что-то пошло не так.");
        return;
      }
      setArchiveMessage(
        data.created > 0 ? `Создан архив выплат за ${data.archiveMonth}: ${data.created} записей.` : data.message
      );
      router.refresh();
    } catch {
      setArchiveMessage("Не удалось связаться с сервером.");
    } finally {
      setArchiving(false);
    }
  }

  return (
    <div className="space-y-4">
      {isAdmin && (
        <div>
          {!adding && (
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => setAdding(true)}
                className="flex items-center gap-2 rounded-md bg-accent px-3 py-2 text-sm font-medium text-black hover:opacity-90"
              >
                <Plus size={16} /> Добавить выплату
              </button>
              <button
                type="button"
                onClick={handleArchive}
                disabled={archiving}
                className="flex items-center gap-2 rounded-md border border-border px-3 py-2 text-sm text-muted hover:text-foreground disabled:opacity-60"
              >
                <Archive size={16} /> Создать архив за месяц
              </button>
              {archiveMessage && <span className="text-xs text-muted">{archiveMessage}</span>}
            </div>
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

      <div className="rounded-lg border border-border bg-surface">
        <div className="border-b border-border p-4">
          <h2 className="text-sm font-semibold">Журнал выплат</h2>
        </div>
        {payments.length === 0 ? (
          <EmptyState title="Нет данных за выбранный период" hint="Записей о выплатах пока нет." />
        ) : (
          <div className="overflow-x-auto">
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
                  <tr key={p.id} className="row-tint transition-colors">
                    <td className="px-4 py-3 font-medium">{p.player.name}</td>
                    <td className="px-4 py-3 font-mono tabular-nums">
                      <BlurValue blurred={isRandom}>{numberFmt.format(p.amount)} золота</BlurValue>
                    </td>
                    <td className="px-4 py-3">
                      {isAdmin ? (
                        <select
                          value={p.status}
                          disabled={busyId === p.id}
                          onChange={(e) => handleStatusChange(p.id, e.target.value)}
                          className="rounded-md border border-border bg-surface-2 px-2 py-1 text-sm outline-none focus:border-accent disabled:opacity-60"
                        >
                          {STATUSES.map((s) => (
                            <option key={s} value={s}>
                              {s}
                            </option>
                          ))}
                        </select>
                      ) : (
                        <StatusBadge label={p.status} tone={statusTone[p.status] ?? "accent"} />
                      )}
                    </td>
                    <td className="px-4 py-3 text-muted">
                      <div className="flex items-center gap-2">
                        <span>{p.date}</span>
                        {p.source === "archive" && (
                          <span className="rounded-full bg-surface-2 px-2 py-0.5 text-[10px] font-medium text-muted">
                            Архив
                          </span>
                        )}
                      </div>
                    </td>
                    {isAdmin && (
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-1">
                          <button
                            type="button"
                            onClick={() => openEdit(p)}
                            disabled={busyId === p.id}
                            aria-label="Редактировать"
                            className="rounded p-1.5 text-muted hover:bg-surface-2 hover:text-foreground disabled:opacity-60"
                          >
                            <Pencil size={15} />
                          </button>
                          <button
                            type="button"
                            onClick={() => setConfirmDeleteId(p.id)}
                            disabled={busyId === p.id}
                            aria-label="Удалить"
                            className="rounded p-1.5 text-muted hover:bg-surface-2 hover:text-danger disabled:opacity-60"
                          >
                            <Trash2 size={15} />
                          </button>
                        </div>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <Modal open={confirmDeleteId !== null} onClose={() => setConfirmDeleteId(null)} title="Удалить выплату?">
        <p className="mb-4 text-sm text-muted">Это действие нельзя отменить. Запись о выплате будет удалена без возможности восстановления.</p>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={confirmDelete}
            disabled={busyId === confirmDeleteId}
            className="rounded-md bg-danger px-3 py-2 text-sm font-medium text-white hover:opacity-90 disabled:opacity-60"
          >
            Удалить
          </button>
          <button
            type="button"
            onClick={() => setConfirmDeleteId(null)}
            className="rounded-md border border-border px-3 py-2 text-sm text-muted hover:text-foreground"
          >
            Отмена
          </button>
        </div>
      </Modal>

      <Modal open={editing !== null} onClose={() => setEditing(null)} title="Редактировать выплату">
        {editing && (
          <form onSubmit={handleEditSubmit} className="space-y-3">
            <p className="text-xs text-muted">{editing.player.name}</p>
            <div>
              <label className="mb-1 block text-xs text-muted">Сумма</label>
              <input
                type="number"
                value={editAmount}
                onChange={(e) => setEditAmount(e.target.value)}
                min={1}
                required
                className="w-full rounded-md border border-border bg-surface-2 px-3 py-2 text-sm outline-none focus:border-accent"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs text-muted">Статус</label>
              <select
                value={editStatus}
                onChange={(e) => setEditStatus(e.target.value)}
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
                value={editDate}
                onChange={(e) => setEditDate(e.target.value)}
                required
                className="w-full rounded-md border border-border bg-surface-2 px-3 py-2 text-sm outline-none focus:border-accent"
              />
            </div>

            {editError && <p className="text-xs text-danger">{editError}</p>}

            <div className="flex items-center gap-2">
              <button
                type="submit"
                disabled={busyId === editing.id}
                className="rounded-md bg-accent px-3 py-2 text-sm font-medium text-black hover:opacity-90 disabled:opacity-60"
              >
                Сохранить
              </button>
              <button
                type="button"
                onClick={() => setEditing(null)}
                className="rounded-md border border-border px-3 py-2 text-sm text-muted hover:text-foreground"
              >
                Отмена
              </button>
            </div>
          </form>
        )}
      </Modal>
    </div>
  );
}
