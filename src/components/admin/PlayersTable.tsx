"use client";

import { useState, type FormEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Pencil, Trash2, Plus, X } from "lucide-react";
import clsx from "clsx";
import { ROLES } from "@/lib/roles";

type Player = {
  id: string;
  name: string;
  role: string;
  level: number;
  xp: number;
  attendancePct: number;
  userId: string | null;
};

type FormState = {
  name: string;
  role: string;
  level: string;
  xp: string;
};

const emptyForm: FormState = { name: "", role: ROLES[0], level: "1", xp: "0" };

const numberFmt = new Intl.NumberFormat("ru-RU");

export default function PlayersTable({
  players,
  isAdmin,
  currentUserId,
}: {
  players: Player[];
  isAdmin: boolean;
  currentUserId: string | null;
}) {
  const router = useRouter();
  const [adding, setAdding] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<FormState>(emptyForm);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  function startAdd() {
    setForm(emptyForm);
    setError(null);
    setEditingId(null);
    setAdding(true);
  }

  function startEdit(p: Player) {
    setForm({
      name: p.name,
      role: p.role,
      level: String(p.level),
      xp: String(p.xp),
    });
    setError(null);
    setAdding(false);
    setEditingId(p.id);
  }

  function cancel() {
    setAdding(false);
    setEditingId(null);
    setError(null);
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setBusy(true);

    const payload = {
      name: form.name,
      role: form.role,
      level: Number(form.level),
      xp: Number(form.xp),
    };

    try {
      const res = await fetch(editingId ? `/api/players/${editingId}` : "/api/players", {
        method: editingId ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
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
    if (!confirm("Удалить игрока?")) return;
    setBusy(true);
    await fetch(`/api/players/${id}`, { method: "DELETE" });
    setBusy(false);
    router.refresh();
  }

  return (
    <div className="space-y-4">
      {isAdmin && (
        <div>
          {!adding && !editingId && (
            <button
              type="button"
              onClick={startAdd}
              className="flex items-center gap-2 rounded-md bg-accent px-3 py-2 text-sm font-medium text-black hover:opacity-90"
            >
              <Plus size={16} /> Добавить игрока
            </button>
          )}

          {(adding || editingId) && (
            <form
              onSubmit={handleSubmit}
              className="grid grid-cols-1 gap-3 rounded-lg border border-border bg-surface p-4 sm:grid-cols-2 lg:grid-cols-6"
            >
              <div className="lg:col-span-2">
                <label className="mb-1 block text-xs text-muted">Имя</label>
                <input
                  value={form.name}
                  onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                  required
                  maxLength={40}
                  className="w-full rounded-md border border-border bg-surface-2 px-3 py-2 text-sm outline-none focus:border-accent"
                />
              </div>
              <div>
                <label className="mb-1 block text-xs text-muted">Роль</label>
                <select
                  value={form.role}
                  onChange={(e) => setForm((f) => ({ ...f, role: e.target.value }))}
                  className="w-full rounded-md border border-border bg-surface-2 px-3 py-2 text-sm outline-none focus:border-accent"
                >
                  {ROLES.map((r) => (
                    <option key={r} value={r}>
                      {r}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="mb-1 block text-xs text-muted">Уровень</label>
                <input
                  type="number"
                  value={form.level}
                  onChange={(e) => setForm((f) => ({ ...f, level: e.target.value }))}
                  min={1}
                  max={999}
                  required
                  className="w-full rounded-md border border-border bg-surface-2 px-3 py-2 text-sm outline-none focus:border-accent"
                />
              </div>
              <div>
                <label className="mb-1 block text-xs text-muted">XP</label>
                <input
                  type="number"
                  value={form.xp}
                  onChange={(e) => setForm((f) => ({ ...f, xp: e.target.value }))}
                  min={0}
                  required
                  className="w-full rounded-md border border-border bg-surface-2 px-3 py-2 text-sm outline-none focus:border-accent"
                />
              </div>
              {error && <p className="text-xs text-danger lg:col-span-6">{error}</p>}

              <div className="flex items-end gap-2 lg:col-span-6">
                <button
                  type="submit"
                  disabled={busy}
                  className="rounded-md bg-accent px-3 py-2 text-sm font-medium text-black hover:opacity-90 disabled:opacity-60"
                >
                  {editingId ? "Сохранить" : "Добавить"}
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

      <div className="overflow-x-auto rounded-lg border border-border bg-surface">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border text-left text-xs uppercase tracking-wider text-muted">
              <th className="px-4 py-3 font-medium">Имя</th>
              <th className="px-4 py-3 font-medium">Роль</th>
              <th className="px-4 py-3 font-medium">Уровень</th>
              <th className="px-4 py-3 font-medium">XP</th>
              <th className="px-4 py-3 font-medium" title="Считается автоматически: доля активностей за 30 дней, в которых участвовал игрок">
                Посещаемость
              </th>
              {isAdmin && <th className="px-4 py-3 font-medium" />}
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {players.map((p) => {
              const isSelf = currentUserId !== null && p.userId === currentUserId;
              return (
              <tr
                key={p.id}
                className={clsx("hover:bg-surface-2", isSelf && "bg-accent-soft")}
              >
                <td className="px-4 py-3">
                  <Link href={`/players/${p.id}`} className="font-medium hover:text-accent">
                    {p.name}
                  </Link>
                  {isSelf && (
                    <span className="ml-2 rounded-full border border-accent/40 px-1.5 py-0.5 text-[10px] font-medium text-accent">
                      это вы
                    </span>
                  )}
                </td>
                <td className="px-4 py-3 text-muted">{p.role}</td>
                <td className="px-4 py-3">{p.level}</td>
                <td className="px-4 py-3">{numberFmt.format(p.xp)}</td>
                <td className="px-4 py-3">
                  <div className="flex items-center gap-2">
                    <div className="h-1.5 w-20 overflow-hidden rounded-full bg-surface-2">
                      <div
                        className="h-full rounded-full bg-accent"
                        style={{ width: `${Math.min(p.attendancePct, 100)}%` }}
                      />
                    </div>
                    <span className="text-xs font-medium text-accent">{p.attendancePct}%</span>
                  </div>
                </td>
                {isAdmin && (
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => startEdit(p)}
                        aria-label="Редактировать"
                        className="rounded p-1.5 text-muted hover:bg-surface-2 hover:text-foreground"
                      >
                        <Pencil size={15} />
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDelete(p.id)}
                        aria-label="Удалить"
                        className="rounded p-1.5 text-muted hover:bg-surface-2 hover:text-danger"
                      >
                        <Trash2 size={15} />
                      </button>
                    </div>
                  </td>
                )}
              </tr>
              );
            })}
            {players.length === 0 && (
              <tr>
                <td colSpan={isAdmin ? 6 : 5} className="px-4 py-6 text-center text-muted">
                  Пока никого нет в составе.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
