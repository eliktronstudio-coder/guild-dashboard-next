"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { Pencil, Check, X, Plus, Trash2, Moon } from "lucide-react";
import clsx from "clsx";
import { ACTIVITY_STATUSES, statusColor, roleColor } from "@/lib/activityOptions";

const numberFmt = new Intl.NumberFormat("ru-RU");

type Drop = {
  id: string;
  item: string;
  quantity: number;
  value: number;
  playerName: string | null;
};

type Player = { id: string; name: string; role: string };

type Activity = {
  id: string;
  name: string;
  category: string;
  mode: string;
  difficulty: string;
  status: string;
  isNight: boolean;
  perAttendanceValue: number;
  addedByUsername: string | null;
  date: string;
  dropTotal: number;
  roleCounts: Record<string, number>;
  roster: Player[];
  drops: Drop[];
};

export default function ActivityDetailPanel({ activity, isAdmin }: { activity: Activity; isAdmin: boolean }) {
  const router = useRouter();
  const [status, setStatus] = useState(activity.status);
  const [editingPerAttendance, setEditingPerAttendance] = useState(false);
  const [perAttendance, setPerAttendance] = useState(String(activity.perAttendanceValue));
  const [addingDrop, setAddingDrop] = useState(false);
  const [dropItem, setDropItem] = useState("");
  const [dropQty, setDropQty] = useState("1");
  const [dropValue, setDropValue] = useState("");
  const [dropPlayerId, setDropPlayerId] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function handleStatusChange(newStatus: string) {
    setStatus(newStatus);
    setBusy(true);
    await fetch(`/api/activities/${activity.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: newStatus }),
    });
    setBusy(false);
    router.refresh();
  }

  async function handleSavePerAttendance() {
    setBusy(true);
    const res = await fetch(`/api/activities/${activity.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ perAttendanceValue: Number(perAttendance) }),
    });
    setBusy(false);
    if (res.ok) {
      setEditingPerAttendance(false);
      router.refresh();
    }
  }

  async function handleAddDrop(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      const res = await fetch("/api/drops", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          item: dropItem,
          quantity: Number(dropQty),
          value: Number(dropValue),
          activityId: activity.id,
          playerId: dropPlayerId || null,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Что-то пошло не так.");
        setBusy(false);
        return;
      }
      setAddingDrop(false);
      setDropItem("");
      setDropQty("1");
      setDropValue("");
      setDropPlayerId("");
      router.refresh();
    } catch {
      setError("Не удалось связаться с сервером.");
    } finally {
      setBusy(false);
    }
  }

  async function handleDeleteDrop(id: string) {
    if (!confirm("Удалить предмет из дропа?")) return;
    setBusy(true);
    await fetch(`/api/drops/${id}`, { method: "DELETE" });
    setBusy(false);
    router.refresh();
  }

  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
      <div className="space-y-4 lg:col-span-2">
        <div className="rounded-lg border border-border bg-surface p-4">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="text-lg font-semibold">{activity.name}</h2>
            <span className="rounded-md border border-border bg-surface-2 px-1.5 py-0.5 text-xs text-muted">
              {activity.category}
            </span>
            <span
              className={clsx(
                "rounded-md border px-1.5 py-0.5 text-xs",
                activity.mode === "PvP" ? "border-danger/40 bg-danger/10 text-danger" : "border-success/40 bg-success/10 text-success"
              )}
            >
              {activity.mode}
            </span>
            {isAdmin ? (
              <select
                value={status}
                disabled={busy}
                onChange={(e) => handleStatusChange(e.target.value)}
                className={clsx(
                  "rounded-md border px-1.5 py-0.5 text-xs outline-none disabled:opacity-60",
                  statusColor[status]
                )}
              >
                {ACTIVITY_STATUSES.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
            ) : (
              <span className={clsx("rounded-md border px-1.5 py-0.5 text-xs", statusColor[status])}>{status}</span>
            )}
            {activity.isNight && (
              <span className="flex items-center gap-1 rounded-md border border-border bg-surface-2 px-1.5 py-0.5 text-xs text-muted">
                <Moon size={11} /> Ночь
              </span>
            )}
          </div>

          <div className="mt-4 flex flex-wrap gap-6">
            <div>
              <p className="text-2xl font-semibold">{activity.roster.length}</p>
              <p className="text-xs text-muted">участников</p>
            </div>
            <div>
              <p className="text-2xl font-semibold text-accent">{numberFmt.format(activity.dropTotal)}</p>
              <p className="text-xs text-muted">оценка дропа</p>
            </div>
            <div>
              {editingPerAttendance ? (
                <div className="flex items-center gap-1">
                  <input
                    type="number"
                    value={perAttendance}
                    onChange={(e) => setPerAttendance(e.target.value)}
                    min={0}
                    className="w-24 rounded-md border border-border bg-surface-2 px-2 py-1 text-lg outline-none focus:border-accent"
                    autoFocus
                  />
                  <button type="button" onClick={handleSavePerAttendance} className="rounded p-1 text-success hover:bg-surface-2">
                    <Check size={16} />
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setEditingPerAttendance(false);
                      setPerAttendance(String(activity.perAttendanceValue));
                    }}
                    className="rounded p-1 text-muted hover:bg-surface-2"
                  >
                    <X size={16} />
                  </button>
                </div>
              ) : (
                <p className="flex items-center gap-1.5 text-2xl font-semibold">
                  {numberFmt.format(activity.perAttendanceValue)}
                  {isAdmin && (
                    <button
                      type="button"
                      onClick={() => setEditingPerAttendance(true)}
                      className="rounded p-1 text-muted hover:bg-surface-2 hover:text-foreground"
                    >
                      <Pencil size={13} />
                    </button>
                  )}
                </p>
              )}
              <p className="text-xs text-muted">с посещения</p>
            </div>
          </div>
        </div>

        <div className="rounded-lg border border-border bg-surface p-4">
          <div className="mb-3 flex items-center justify-between">
            <h3 className="flex items-center gap-1.5 text-sm font-semibold">Дроп</h3>
            {isAdmin && !addingDrop && (
              <button
                type="button"
                onClick={() => setAddingDrop(true)}
                className="flex items-center gap-1.5 rounded-md border border-border px-2 py-1 text-xs text-foreground/80 hover:bg-surface-2 hover:text-foreground"
              >
                <Plus size={13} /> Добавить предмет
              </button>
            )}
          </div>

          {addingDrop && (
            <form
              onSubmit={handleAddDrop}
              className="mb-3 grid grid-cols-2 gap-2 rounded-md border border-border bg-surface-2 p-3 sm:grid-cols-5"
            >
              <div className="sm:col-span-2">
                <input
                  value={dropItem}
                  onChange={(e) => setDropItem(e.target.value)}
                  placeholder="Название предмета"
                  required
                  maxLength={60}
                  className="w-full rounded-md border border-border bg-surface px-2 py-1.5 text-sm outline-none focus:border-accent"
                />
              </div>
              <input
                type="number"
                value={dropQty}
                onChange={(e) => setDropQty(e.target.value)}
                placeholder="Кол-во"
                min={1}
                required
                className="w-full rounded-md border border-border bg-surface px-2 py-1.5 text-sm outline-none focus:border-accent"
              />
              <input
                type="number"
                value={dropValue}
                onChange={(e) => setDropValue(e.target.value)}
                placeholder="Цена"
                min={0}
                required
                className="w-full rounded-md border border-border bg-surface px-2 py-1.5 text-sm outline-none focus:border-accent"
              />
              <select
                value={dropPlayerId}
                onChange={(e) => setDropPlayerId(e.target.value)}
                className="w-full rounded-md border border-border bg-surface px-2 py-1.5 text-sm outline-none focus:border-accent"
              >
                <option value="">Кому — не указано</option>
                {activity.roster.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>
              {error && <p className="text-xs text-danger sm:col-span-5">{error}</p>}
              <div className="flex items-center gap-2 sm:col-span-5">
                <button
                  type="submit"
                  disabled={busy}
                  className="rounded-md bg-accent px-3 py-1.5 text-xs font-medium text-black hover:opacity-90 disabled:opacity-60"
                >
                  Добавить
                </button>
                <button
                  type="button"
                  onClick={() => setAddingDrop(false)}
                  className="rounded-md border border-border px-3 py-1.5 text-xs text-muted hover:text-foreground"
                >
                  Отмена
                </button>
              </div>
            </form>
          )}

          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
            {activity.drops.map((d) => (
              <div key={d.id} className="relative rounded-md border border-border bg-surface-2 p-3">
                {isAdmin && (
                  <button
                    type="button"
                    onClick={() => handleDeleteDrop(d.id)}
                    aria-label="Удалить"
                    className="absolute right-1.5 top-1.5 rounded p-0.5 text-muted hover:text-danger"
                  >
                    <Trash2 size={12} />
                  </button>
                )}
                <p className="pr-4 text-xs font-medium">{d.item}</p>
                <p className="mt-1 text-xs text-muted">
                  ×{d.quantity}
                  {d.playerName && <> · {d.playerName}</>}
                </p>
                <p className="mt-1.5 text-sm font-semibold text-accent">{numberFmt.format(d.value)}</p>
              </div>
            ))}
            {activity.drops.length === 0 && <p className="text-xs text-muted">Дроп ещё не внесён.</p>}
          </div>
        </div>

        <div className="rounded-lg border border-border bg-surface p-4">
          <h3 className="mb-3 text-sm font-semibold">Участники ({activity.roster.length})</h3>
          <div className="flex flex-wrap gap-2">
            {activity.roster.map((p) => (
              <span
                key={p.id}
                className={clsx("rounded-full border px-2.5 py-1 text-xs font-medium", roleColor[p.role] ?? roleColor["Без роли"])}
              >
                {p.name}
              </span>
            ))}
            {activity.roster.length === 0 && <p className="text-xs text-muted">Участники не выбраны.</p>}
          </div>
        </div>
      </div>

      <div className="space-y-4">
        <div className="rounded-lg border border-border bg-surface p-4">
          <h3 className="mb-3 text-sm font-semibold">Информация</h3>
          <dl className="space-y-2 text-sm">
            <Row label="Дата" value={activity.date} />
            <Row label="Категория" value={activity.mode} />
            <Row label="Тип" value={activity.category} />
            <Row label="Участников" value={String(activity.roster.length)} />
            <Row label="Сложность" value={activity.difficulty} />
            <Row label="Ночная акт." value={activity.isNight ? "Да" : "Нет"} />
            <Row label="Добавил" value={activity.addedByUsername ?? "—"} />
          </dl>
        </div>

        <div className="rounded-lg border border-border bg-surface p-4">
          <h3 className="mb-3 text-sm font-semibold">Состав</h3>
          <div className="space-y-2">
            {Object.entries(activity.roleCounts).map(([role, count]) => (
              <div key={role}>
                <div className="mb-1 flex items-center justify-between text-xs">
                  <span className="text-muted">{role}</span>
                  <span>{count}</span>
                </div>
                <div className="h-1.5 overflow-hidden rounded-full bg-surface-2">
                  <div
                    className="h-full rounded-full bg-accent"
                    style={{ width: `${(count / activity.roster.length) * 100}%` }}
                  />
                </div>
              </div>
            ))}
            {activity.roster.length === 0 && <p className="text-xs text-muted">Нет данных.</p>}
          </div>
        </div>
      </div>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between">
      <dt className="text-muted">{label}</dt>
      <dd className="font-medium">{value}</dd>
    </div>
  );
}
