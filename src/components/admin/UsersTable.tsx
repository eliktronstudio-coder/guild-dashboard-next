"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Trash2 } from "lucide-react";

type UserRow = {
  id: string;
  username: string;
  role: string;
  createdAt: string;
};

const dateFmt = new Intl.DateTimeFormat("ru-RU", { day: "numeric", month: "long", year: "numeric" });

export default function UsersTable({ users, currentUserId }: { users: UserRow[]; currentUserId: string }) {
  const router = useRouter();
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

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
              <tr key={u.id} className="hover:bg-surface-2">
                <td className="px-4 py-3 font-medium">
                  {u.username}
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
                    <option value="member">Участник</option>
                  </select>
                </td>
                <td className="px-4 py-3 text-muted">{dateFmt.format(new Date(u.createdAt))}</td>
                <td className="px-4 py-3">
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
                </td>
              </tr>
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
