"use client";

import { useState, type FormEvent } from "react";
import Link from "next/link";
import { useRouter, usePathname } from "next/navigation";
import { Plus, Trash2, X, Search, RotateCcw, ChevronLeft, ChevronRight, Filter } from "lucide-react";
import clsx from "clsx";
import { ACTIVITY_CATEGORIES, ACTIVITY_MODES, ACTIVITY_DIFFICULTIES, ACTIVITY_STATUSES, statusColor } from "@/lib/activityOptions";
import StatCard from "@/components/StatCard";
import EmptyState from "@/components/EmptyState";

type ActivityRow = {
  id: string;
  name: string;
  category: string;
  mode: string;
  difficulty: string;
  status: string;
  isNight: boolean;
  date: string;
  dateIso: string;
  participants: number;
};

type PlayerOption = { id: string; name: string; role: string };
type CatalogItem = { id: string; name: string; price: number };

type Filters = {
  dateFrom?: string;
  dateTo?: string;
  status?: string;
  mode?: string;
  category?: string;
  name?: string;
  player?: string;
  page: number;
};

type Summary = {
  total: number;
  avgAttendance: number;
  bestAttendance: number;
  cancelled: number;
  totalPlayers: number;
};

function todayISO() {
  return new Date().toISOString().slice(0, 10);
}

export default function ActivitiesList({
  activities,
  total,
  totalPages,
  filters,
  distinctNames,
  players,
  catalog,
  isAdmin,
  summary,
}: {
  activities: ActivityRow[];
  total: number;
  totalPages: number;
  filters: Filters;
  distinctNames: string[];
  players: PlayerOption[];
  catalog: CatalogItem[];
  isAdmin: boolean;
  summary: Summary;
}) {
  const router = useRouter();
  const pathname = usePathname();

  const [dateFrom, setDateFrom] = useState(filters.dateFrom ?? "");
  const [dateTo, setDateTo] = useState(filters.dateTo ?? "");
  const [status, setStatus] = useState(filters.status ?? "");
  const [mode, setMode] = useState(filters.mode ?? "");
  const [category, setCategory] = useState(filters.category ?? "");
  const [name, setName] = useState(filters.name ?? "");
  const [player, setPlayer] = useState(filters.player ?? "");

  const [adding, setAdding] = useState(false);
  const [newName, setNewName] = useState("");
  const [newDate, setNewDate] = useState(todayISO());
  const [newCategory, setNewCategory] = useState(ACTIVITY_CATEGORIES[0]);
  const [newMode, setNewMode] = useState(ACTIVITY_MODES[0]);
  const [newDifficulty, setNewDifficulty] = useState(ACTIVITY_DIFFICULTIES[0]);
  const [newIsNight, setNewIsNight] = useState(false);
  const [newPerAttendance, setNewPerAttendance] = useState("0");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [search, setSearch] = useState("");
  const [dropSelected, setDropSelected] = useState<Record<string, string>>({});
  const [dropSearch, setDropSearch] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const filteredPlayers = players.filter((p) => p.name.toLowerCase().includes(search.trim().toLowerCase()));
  const filteredCatalog = catalog.filter((c) => c.name.toLowerCase().includes(dropSearch.trim().toLowerCase()));

  function applyFilters(overrides: Partial<Record<string, string>> = {}) {
    const params = new URLSearchParams();
    const values: Record<string, string> = {
      dateFrom,
      dateTo,
      status,
      mode,
      category,
      name,
      player,
      ...overrides,
    };
    for (const [key, value] of Object.entries(values)) {
      if (value) params.set(key, value);
    }
    router.push(`${pathname}?${params.toString()}`);
  }

  function resetFilters() {
    setDateFrom("");
    setDateTo("");
    setStatus("");
    setMode("");
    setCategory("");
    setName("");
    setPlayer("");
    router.push(pathname);
  }

  function goToPage(p: number) {
    const params = new URLSearchParams();
    const values: Record<string, string> = { dateFrom, dateTo, status, mode, category, name, player };
    for (const [key, value] of Object.entries(values)) {
      if (value) params.set(key, value);
    }
    params.set("page", String(p));
    router.push(`${pathname}?${params.toString()}`);
  }

  function cancelAdd() {
    setAdding(false);
    setNewName("");
    setNewDate(todayISO());
    setNewCategory(ACTIVITY_CATEGORIES[0]);
    setNewMode(ACTIVITY_MODES[0]);
    setNewDifficulty(ACTIVITY_DIFFICULTIES[0]);
    setNewIsNight(false);
    setNewPerAttendance("0");
    setSelected(new Set());
    setSearch("");
    setDropSelected({});
    setDropSearch("");
    setError(null);
  }

  function toggleSelected(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function toggleDrop(id: string) {
    setDropSelected((prev) => {
      const next = { ...prev };
      if (id in next) delete next[id];
      else next[id] = "1";
      return next;
    });
  }

  function setDropQty(id: string, qty: string) {
    setDropSelected((prev) => ({ ...prev, [id]: qty }));
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      const res = await fetch("/api/activities", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: newName,
          date: newDate,
          category: newCategory,
          mode: newMode,
          difficulty: newDifficulty,
          isNight: newIsNight,
          perAttendanceValue: Number(newPerAttendance),
          participantIds: [...selected],
          drops: Object.entries(dropSelected).map(([catalogItemId, quantity]) => ({
            catalogItemId,
            quantity: Number(quantity) || 1,
          })),
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Что-то пошло не так.");
        setBusy(false);
        return;
      }
      cancelAdd();
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

  const pageSize = activities.length > 0 ? activities.length : 15;
  const from = total === 0 ? 0 : (filters.page - 1) * 15 + 1;
  const to = total === 0 ? 0 : from + pageSize - 1;

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard label="Активностей за период" value={String(summary.total)} hint="в текущей выборке" />
        <StatCard label="Средняя посещаемость" value={String(summary.avgAttendance)} hint="участников на активность" />
        <StatCard label="Лучший показатель" value={String(summary.bestAttendance)} hint="максимум участников" />
        <StatCard label="Отменено" value={String(summary.cancelled)} hint="в текущей выборке" />
      </div>

      <div className="rounded-lg border border-border bg-surface p-4">
        <div className="mb-3 flex items-center gap-2 text-sm font-semibold">
          <Filter size={15} className="text-accent" /> Фильтры
        </div>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
          <div>
            <label className="mb-1 block text-xs text-muted">Дата с</label>
            <input
              type="date"
              value={dateFrom}
              onChange={(e) => setDateFrom(e.target.value)}
              className="w-full rounded-md border border-border bg-surface-2 px-2 py-1.5 text-sm outline-none focus:border-accent"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs text-muted">Дата по</label>
            <input
              type="date"
              value={dateTo}
              onChange={(e) => setDateTo(e.target.value)}
              className="w-full rounded-md border border-border bg-surface-2 px-2 py-1.5 text-sm outline-none focus:border-accent"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs text-muted">Статус</label>
            <select
              value={status}
              onChange={(e) => setStatus(e.target.value)}
              className="w-full rounded-md border border-border bg-surface-2 px-2 py-1.5 text-sm outline-none focus:border-accent"
            >
              <option value="">Все статусы</option>
              {ACTIVITY_STATUSES.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="mb-1 block text-xs text-muted">Вид</label>
            <select
              value={mode}
              onChange={(e) => setMode(e.target.value)}
              className="w-full rounded-md border border-border bg-surface-2 px-2 py-1.5 text-sm outline-none focus:border-accent"
            >
              <option value="">Все</option>
              {ACTIVITY_MODES.map((m) => (
                <option key={m} value={m}>
                  {m}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="mb-1 block text-xs text-muted">Активность</label>
            <select
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full rounded-md border border-border bg-surface-2 px-2 py-1.5 text-sm outline-none focus:border-accent"
            >
              <option value="">Все активности</option>
              {distinctNames.map((n) => (
                <option key={n} value={n}>
                  {n}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="mb-1 block text-xs text-muted">Игрок</label>
            <input
              value={player}
              onChange={(e) => setPlayer(e.target.value)}
              placeholder="Ник…"
              className="w-full rounded-md border border-border bg-surface-2 px-2 py-1.5 text-sm outline-none focus:border-accent"
            />
          </div>
        </div>
        <div className="mt-3 flex items-center gap-2">
          <button
            type="button"
            onClick={() => applyFilters()}
            className="flex items-center gap-2 rounded-md bg-accent px-3 py-2 text-sm font-medium text-black hover:opacity-90"
          >
            <Search size={14} /> Найти
          </button>
          <button
            type="button"
            onClick={resetFilters}
            className="flex items-center gap-2 rounded-md border border-border px-3 py-2 text-sm text-muted hover:text-foreground"
          >
            <RotateCcw size={14} /> Сбросить
          </button>
        </div>
      </div>

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
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
                <div>
                  <label className="mb-1 block text-xs text-muted">Название</label>
                  <input
                    value={newName}
                    onChange={(e) => setNewName(e.target.value)}
                    required
                    maxLength={60}
                    list="activity-name-options"
                    placeholder="Выберите или введите новое"
                    className="w-full rounded-md border border-border bg-surface-2 px-3 py-2 text-sm outline-none focus:border-accent"
                  />
                  <datalist id="activity-name-options">
                    {distinctNames.map((n) => (
                      <option key={n} value={n} />
                    ))}
                  </datalist>
                </div>
                <div>
                  <label className="mb-1 block text-xs text-muted">Дата</label>
                  <input
                    type="date"
                    value={newDate}
                    onChange={(e) => setNewDate(e.target.value)}
                    required
                    className="w-full rounded-md border border-border bg-surface-2 px-3 py-2 text-sm outline-none focus:border-accent"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs text-muted">Вид</label>
                  <select
                    value={newCategory}
                    onChange={(e) => setNewCategory(e.target.value)}
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
                    value={newMode}
                    onChange={(e) => setNewMode(e.target.value)}
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
                    value={newDifficulty}
                    onChange={(e) => setNewDifficulty(e.target.value)}
                    className="w-full rounded-md border border-border bg-surface-2 px-3 py-2 text-sm outline-none focus:border-accent"
                  >
                    {ACTIVITY_DIFFICULTIES.map((d) => (
                      <option key={d} value={d}>
                        {d}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="mb-1 block text-xs text-muted">Золота за посещение</label>
                  <input
                    type="number"
                    value={newPerAttendance}
                    onChange={(e) => setNewPerAttendance(e.target.value)}
                    min={0}
                    className="w-full rounded-md border border-border bg-surface-2 px-3 py-2 text-sm outline-none focus:border-accent"
                  />
                </div>
                <div className="flex items-end">
                  <label className="flex cursor-pointer items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      checked={newIsNight}
                      onChange={(e) => setNewIsNight(e.target.checked)}
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
                {selected.size > 0 && <p className="mt-1.5 text-xs text-muted">Выбрано: {selected.size}</p>}
              </div>

              <div>
                <p className="mb-1.5 text-xs text-muted">
                  Дроп <span className="text-muted/70">(необязательно, из реестра)</span>
                </p>
                <div className="relative mb-2">
                  <Search size={14} className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-muted" />
                  <input
                    value={dropSearch}
                    onChange={(e) => setDropSearch(e.target.value)}
                    placeholder="Поиск по названию…"
                    className="w-full rounded-md border border-border bg-surface-2 py-2 pl-8 pr-3 text-sm outline-none focus:border-accent"
                  />
                </div>
                <div className="flex max-h-52 flex-col gap-1 overflow-y-auto rounded-md border border-border bg-surface-2 p-2">
                  {catalog.length === 0 && (
                    <p className="text-xs text-muted">
                      Реестр дропа пуст — добавьте предметы в разделе «Реестр дропа».
                    </p>
                  )}
                  {catalog.length > 0 && filteredCatalog.length === 0 && (
                    <p className="text-xs text-muted">Ничего не найдено.</p>
                  )}
                  {filteredCatalog.map((c) => {
                    const checked = c.id in dropSelected;
                    return (
                      <label
                        key={c.id}
                        className="flex cursor-pointer items-center gap-2 rounded-md border border-border bg-surface px-2 py-1.5 text-xs"
                      >
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={() => toggleDrop(c.id)}
                          className="accent-accent"
                        />
                        <span className="flex-1">
                          {c.name} <span className="text-muted">· {c.price}/ед.</span>
                        </span>
                        {checked && (
                          <input
                            type="number"
                            min={1}
                            value={dropSelected[c.id]}
                            onChange={(e) => setDropQty(c.id, e.target.value)}
                            onClick={(e) => e.preventDefault()}
                            className="w-16 rounded border border-border bg-surface-2 px-1.5 py-1 text-xs outline-none focus:border-accent"
                          />
                        )}
                      </label>
                    );
                  })}
                </div>
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
                  onClick={cancelAdd}
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
        <div className="flex items-center justify-between border-b border-border p-4">
          <h2 className="text-sm font-semibold">Журнал активностей</h2>
          <span className="text-xs text-muted">
            {from}-{to} / {total} активностей
          </span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border text-left text-xs uppercase tracking-wider text-muted">
                <th className="px-4 py-3 font-medium">Дата</th>
                <th className="px-4 py-3 font-medium">Активность</th>
                <th className="px-4 py-3 font-medium">Тип</th>
                <th className="px-4 py-3 font-medium">Сложность</th>
                <th className="px-4 py-3 font-medium">Игроков</th>
                <th className="px-4 py-3 font-medium">Посещаемость</th>
                <th className="px-4 py-3 font-medium">Статус</th>
                {isAdmin && <th className="px-4 py-3 font-medium" />}
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {activities.map((a) => (
                <tr key={a.id} className="hover:bg-surface-2">
                  <td className="whitespace-nowrap px-4 py-3 text-muted">{a.dateIso}</td>
                  <td className="px-4 py-3">
                    <Link href={`/activities/${a.id}`} className="font-medium hover:text-accent">
                      {a.name}
                    </Link>
                    {a.isNight && <span className="ml-1.5 text-xs text-muted">🌙</span>}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex flex-wrap gap-1">
                      <span className="rounded-md border border-border bg-surface-2 px-1.5 py-0.5 text-xs text-muted">
                        {a.category}
                      </span>
                      <span
                        className={clsx(
                          "rounded-md border px-1.5 py-0.5 text-xs",
                          a.mode === "PvP" ? "border-danger/40 bg-danger/10 text-danger" : "border-success/40 bg-success/10 text-success"
                        )}
                      >
                        {a.mode}
                      </span>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-muted">{a.difficulty}</td>
                  <td className="px-4 py-3">{a.participants}</td>
                  <td className="px-4 py-3 font-mono tabular-nums text-muted">
                    {summary.totalPlayers > 0
                      ? `${Math.min(100, Math.round((a.participants / summary.totalPlayers) * 100))}%`
                      : "—"}
                  </td>
                  <td className="px-4 py-3">
                    <span className={clsx("rounded-md border px-2 py-0.5 text-xs font-medium", statusColor[a.status])}>
                      {a.status}
                    </span>
                  </td>
                  {isAdmin && (
                    <td className="px-4 py-3">
                      <button
                        type="button"
                        onClick={() => handleDelete(a.id)}
                        aria-label="Удалить"
                        className="rounded p-1.5 text-muted hover:bg-surface-2 hover:text-danger"
                      >
                        <Trash2 size={15} />
                      </button>
                    </td>
                  )}
                </tr>
              ))}
              {activities.length === 0 && (
                <tr>
                  <td colSpan={isAdmin ? 8 : 7}>
                    <EmptyState />
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        {totalPages > 1 && (
          <div className="flex items-center justify-center gap-3 border-t border-border p-3 text-sm">
            <button
              type="button"
              onClick={() => goToPage(Math.max(1, filters.page - 1))}
              disabled={filters.page <= 1}
              className="rounded-md border border-border p-1.5 text-muted hover:text-foreground disabled:opacity-40"
            >
              <ChevronLeft size={16} />
            </button>
            <span className="text-xs text-muted">
              стр. {filters.page} / {totalPages}
            </span>
            <button
              type="button"
              onClick={() => goToPage(Math.min(totalPages, filters.page + 1))}
              disabled={filters.page >= totalPages}
              className="rounded-md border border-border p-1.5 text-muted hover:text-foreground disabled:opacity-40"
            >
              <ChevronRight size={16} />
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
