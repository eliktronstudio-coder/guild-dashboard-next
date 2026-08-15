"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { Pencil, Check, X, Plus, Trash2, Moon, Search } from "lucide-react";
import clsx from "clsx";
import {
  ACTIVITY_STATUSES,
  ACTIVITY_CATEGORIES,
  ACTIVITY_MODES,
  ACTIVITY_DIFFICULTIES,
  statusColor,
  roleColor,
} from "@/lib/activityOptions";

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
  dateIso: string;
  dropTotal: number;
  roleCounts: Record<string, number>;
  roster: Player[];
  drops: Drop[];
};

export default function ActivityDetailPanel({
  activity,
  players,
  isAdmin,
}: {
  activity: Activity;
  players: Player[];
  isAdmin: boolean;
}) {
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

  const [editingActivity, setEditingActivity] = useState(false);
  const [editName, setEditName] = useState(activity.name);
  const [editDate, setEditDate] = useState(activity.dateIso);
  const [editCategory, setEditCategory] = useState(activity.category);
  const [editMode, setEditMode] = useState(activity.mode);
  const [editDifficulty, setEditDifficulty] = useState(activity.difficulty);
  const [editIsNight, setEditIsNight] = useState(activity.isNight);
  const [editSelected, setEditSelected] = useState<Set<string>>(new Set(activity.roster.map((p) => p.id)));
  const [editSearch, setEditSearch] = useState("");
  const [editError, setEditError] = useState<string | null>(null);
  const [editBusy, setEditBusy] = useState(false);

  const filteredPlayers = players.filter((p) => p.name.toLowerCase().includes(editSearch.trim().toLowerCase()));

  function toggleEditSelected(id: string) {
    setEditSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function cancelEditActivity() {
    setEditingActivity(false);
    setEditName(activity.name);
    setEditDate(activity.dateIso);
    setEditCategory(activity.category);
    setEditMode(activity.mode);
    setEditDifficulty(activity.difficulty);
    setEditIsNight(activity.isNight);
    setEditSelected(new Set(activity.roster.map((p) => p.id)));
    setEditSearch("");
    setEditError(null);
  }

  async function handleSaveActivity(e: FormEvent) {
    e.preventDefault();
    setEditError(null);
    setEditBusy(true);
    try {
      const res = await fetch(`/api/activities/${activity.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: editName,
          date: editDate,
          category: editCategory,
          mode: editMode,
          difficulty: editDifficulty,
          isNight: editIsNight,
          participantIds: [...editSelected],
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setEditError(data.error ?? "Что-то пошло не так.");
        setEditBusy(false);
        return;
      }
      setEditingActivity(false);
      router.refresh();
    } catch {
      setEditError("Не удалось связаться с сервером.");
    } finally {
      setEditBusy(false);
    }
  }

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
          {!editingActivity && (
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
              {isAdmin && (
                <button
                  type="button"
                  onClick={() => setEditingActivity(true)}
                  className="ml-auto flex items-center gap-1.5 rounded-md border border-border px-2 py-1 text-xs text-foreground/80 hover:bg-surface-2 hover:text-foreground"
                >
                  <Pencil size={13} /> Редактировать
                </button>
              )}
            </div>
          )}

          {editingActivity && (
            <form onSubmit={handleSaveActivity} className="space-y-3">
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
                <div>
                  <label className="mb-1 block text-xs text-muted">Название</label>
                  <input
                    value={editName}
                    onChange={(e) => setEditName(e.target.value)}
                    required
                    maxLength={60}
                    className="w-full rounded-md border border-border bg-surface-2 px-3 py-2 text-sm outline-none focus:border-accent"
                  />
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
                <div>
                  <label className="mb-1 block text-xs text-muted">Вид</label>
                  <select
                    value={editCategory}
                    onChange={(e) => setEditCategory(e.target.value)}
                    className="w-full rounded-md border border-border bg-surface-2 px-3 py-2 text-sm outline-none focus:border-accent"
                  >
                    {ACTIVITY_CATEGORIES.map((c) => (
                      <option key={c} value={c}>
                        {c}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="mb-1 block text-xs text-muted">Режим</label>
                  <select
                    value={editMode}
                    onChange={(e) => setEditMode(e.target.value)}
                    className="w-full rounded-md border border-border bg-surface-2 px-3 py-2 text-sm outline-none focus:border-accent"
                  >
                    {ACTIVITY_MODES.map((m) => (
                      <option key={m} value={m}>
                        {m}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="mb-1 block text-xs text-muted">Сложность</label>
                  <select
                    value={editDifficulty}
                    onChange={(e) => setEditDifficulty(e.target.value)}
                    className="w-full rounded-md border border-border bg-surface-2 px-3 py-2 text-sm outline-none focus:border-accent"
                  >
                    {ACTIVITY_DIFFICULTIES.map((d) => (
                      <option key={d} value={d}>
                        {d}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="flex items-end">
                  <label className="flex cursor-pointer items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      checked={editIsNight}
                      onChange={(e) => setEditIsNight(e.target.checked)}
                      className="accent-accent"
                    />
                    Ночная активность
                  </label>
                </div>
              </div>

              <div>
                <p className="mb-1.5 text-xs text-muted">
                  Состав <span className="text-muted/70">(только зарегистрированные на сайте)</span>
                </p>
                <div className="relative mb-2">
                  <Search size={14} className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-muted" />
                  <input
                    value={editSearch}
                    onChange={(e) => setEditSearch(e.target.value)}
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
                        checked={editSelected.has(p.id)}
                        onChange={() => toggleEditSelected(p.id)}
                        className="accent-accent"
                      />
                      {p.name} <span className="text-muted">· {p.role}</span>
                    </label>
                  ))}
                </div>
                {editSelected.size > 0 && <p className="mt-1.5 text-xs text-muted">Выбрано: {editSelected.size}</p>}
              </div>

              {editError && <p className="text-xs text-danger">{editError}</p>}

              <div className="flex items-center gap-2">
                <button
                  type="submit"
                  disabled={editBusy}
                  className="rounded-md bg-accent px-3 py-2 text-sm font-medium text-black hover:opacity-90 disabled:opacity-60"
                >
                  Сохранить
                </button>
                <button
                  type="button"
                  onClick={cancelEditActivity}
                  className="flex items-center gap-1 rounded-md border border-border px-3 py-2 text-sm text-muted hover:text-foreground"
                >
                  <X size={14} /> Отмена
                </button>
              </div>
            </form>
          )}

          {!editingActivity && (
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
          )}
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
