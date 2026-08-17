"use client";

import { Fragment, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { Trash2, UserPlus, KeyRound, X } from "lucide-react";

type UserRow = {
  id: string;
  username: string;
  role: string;
  createdAt: string;
  inRoster: boolean;
  playerName: string | null;
};

const dateFmt = new Intl.DateTimeFormat("ru-RU", { day: "numeric", month: "long", year: "numeric" });

export default function UsersTable({ users, currentUserId }: { users: UserRow[]; currentUserId: string }) {
  const router = useRouter();
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [resettingId, setResettingId] = useState<string | null>(null);
  const [newPassword, setNewPassword] = useState("");
  const [resetError, setResetError] = useState<string | null>(null);

  async function handleRoleChange(id: string, role: string) {
    setBusyId(id);
    setError(null);
    const res = await fetch(`/api/users/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ role }),
    });
    const data = await res.json();
    if (!res.ok) setError(data.error ?? "Что-то пошло не так.");
    setBusyId(null);
    router.refresh();
  }

  async function handleAddToRoster(id: string, username: string) {
    setBusyId(id);
    setError(null);
    const res = await fetch("/api/players", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: username, role: "Без роли", level: 1, xp: 0, userId: id }),
    });
    const data = await res.json();
    if (!res.ok) setError(data.error ?? "Что-то пошло не так.");
    setBusyId(null);
    router.refresh();
  }

  async function handleDelete(id: string) {
    if (!confirm("Удалить пользователя?")) return;
    setBusyId(id);
    setError(null);
    const res = await fetch(`/api/users/${id}`, { method: "DELETE" });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) setError(data.error ?? "Что-то пошло не так.");
    setBusyId(null);
    router.refresh();
  }

  function startReset(id: string) {
    setResettingId(id);
    setNewPassword("");
    setResetError(null);
  }

  function cancelReset() {
    setResettingId(null);
    setNewPassword("");
    setResetError(null);
  }

  async function handleResetPassword(e: FormEvent, id: string) {
    e.preventDefault();
    setResetError(null);
    setBusyId(id);
    const res = await fetch(`/api/users/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ newPassword }),
    });
    const data = await res.json();
    setBusyId(null);
    if (!res.ok) {
      setResetError(data.error ?? "Что-то пошло не так.");
      return;
    }
    cancelReset();
    router.refresh();
  }

  return (
    <div className="space-y-3">
      {error && <p className="text-xs text-danger">{error}</p>}
      <div className="overflow-x-auto rounded-lg border border-border bg-surface">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border text-left text-xs uppercase tracking-wider text-muted">
              <th className="px-4 py-3 font-medium">Логин</th>
              <th className="px-4 py-3 font-medium">Роль</th>
              <th className="px-4 py-3 font-medium">Дата регистрации</th>
              <th className="px-4 py-3 font-medium" />
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {users.map((u) => (
              <Fragment key={u.id}>
                <tr className="hover:bg-surface-2">
                  <td className="px-4 py-3 font-medium">
                    {u.username}
                    {u.playerName && <span className="text-muted"> / {u.playerName}</span>}
                    {u.id === currentUserId && <span className="ml-2 text-xs text-muted">(вы)</span>}
                  </td>
                  <td className="px-4 py-3">
                    <select
                      value={u.role}
                      disabled={busyId === u.id || u.id === currentUserId}
                      onChange={(e) => handleRoleChange(u.id, e.target.value)}
                      className="rounded-md border border-border bg-surface-2 px-2 py-1 text-sm outline-none focus:border-accent disabled:opacity-60"
                    >
                      <option value="admin">Админ</option>
                      <option value="gm">ГМ</option>
                      <option value="rl">РЛ</option>
                      <option value="member">Участник</option>
                    </select>
                  </td>
                  <td className="px-4 py-3 text-muted">{dateFmt.format(new Date(u.createdAt))}</td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      {u.inRoster ? (
                        <span className="text-xs text-muted">В составе</span>
                      ) : (
                        <button
                          type="button"
                          onClick={() => handleAddToRoster(u.id, u.username)}
                          disabled={busyId === u.id}
                          className="flex items-center gap-1.5 rounded-md border border-border px-2 py-1 text-xs text-foreground/80 hover:bg-surface-2 hover:text-foreground disabled:opacity-60"
                        >
                          <UserPlus size={13} /> Добавить в состав
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={() => (resettingId === u.id ? cancelReset() : startReset(u.id))}
                        disabled={busyId === u.id}
                        aria-label="Сбросить пароль"
                        className="rounded p-1.5 text-muted hover:bg-surface-2 hover:text-foreground disabled:opacity-60"
                      >
                        <KeyRound size={15} />
                      </button>
                      {u.id !== currentUserId && (
                        <button
                          type="button"
                          onClick={() => handleDelete(u.id)}
                          disabled={busyId === u.id}
                          aria-label="Удалить"
                          className="rounded p-1.5 text-muted hover:bg-surface-2 hover:text-danger disabled:opacity-60"
                        >
                          <Trash2 size={15} />
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
                {resettingId === u.id && (
                  <tr>
                    <td colSpan={4} className="bg-surface-2 px-4 py-3">
                      <form onSubmit={(e) => handleResetPassword(e, u.id)} className="flex flex-wrap items-center gap-2">
                        <span className="text-xs text-muted">Новый пароль для {u.username}:</span>
                        <input
                          type="password"
                          value={newPassword}
                          onChange={(e) => setNewPassword(e.target.value)}
                          required
                          minLength={6}
                          placeholder="Не короче 6 символов"
                          className="rounded-md border border-border bg-surface px-3 py-1.5 text-sm outline-none focus:border-accent"
                        />
                        <button
                          type="submit"
                          disabled={busyId === u.id}
                          className="rounded-md bg-accent px-3 py-1.5 text-xs font-medium text-black hover:opacity-90 disabled:opacity-60"
                        >
                          Сохранить
                        </button>
                        <button
                          type="button"
                          onClick={cancelReset}
                          className="flex items-center gap-1 rounded-md border border-border px-3 py-1.5 text-xs text-muted hover:text-foreground"
                        >
                          <X size={13} /> Отмена
                        </button>
                        {resetError && <p className="w-full text-xs text-danger">{resetError}</p>}
                      </form>
                    </td>
                  </tr>
                )}
              </Fragment>
            ))}
            {users.length === 0 && (
              <tr>
                <td colSpan={4} className="px-4 py-6 text-center text-muted">
                  Пока никто не зарегистрировался.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
