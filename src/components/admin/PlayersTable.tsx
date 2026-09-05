"use client";

import { useMemo, useState, type FormEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Pencil, Trash2, Plus, X, Search } from "lucide-react";
import clsx from "clsx";
import { ROLES } from "@/lib/roles";
import EmptyState from "@/components/EmptyState";
import BlurValue from "@/components/BlurValue";

type Player = {
  id: string;
  name: string;
  role: string;
  attendancePct: number;
  attendancePctPrime: number;
  attendancePctMiniRb: number;
  pvpCount: number;
  salaryCoefficient: number;
  salary: number;
  salaryPrime: number;
  salaryMiniRb: number;
  userId: string | null;
};

type FormState = {
  name: string;
  role: string;
  salaryCoefficient: string;
};

type SortKey = "name" | "attendance" | "attendancePrime" | "attendanceMiniRb" | "pvp" | "salary";

const emptyForm: FormState = { name: "", role: ROLES[0], salaryCoefficient: "1" };

const numberFmt = new Intl.NumberFormat("ru-RU");
const coefficientFmt = new Intl.NumberFormat("ru-RU", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

function attendanceColor(pct: number) {
  if (pct <= 20) return { text: "text-danger", bar: "bg-danger" };
  if (pct <= 50) return { text: "text-amber-500", bar: "bg-amber-500" };
  return { text: "text-success", bar: "bg-success" };
}

export default function PlayersTable({
  players,
  isAdmin,
  currentUserId,
  isRandom = false,
}: {
  players: Player[];
  isAdmin: boolean;
  currentUserId: string | null;
  isRandom?: boolean;
}) {
  const router = useRouter();
  const [adding, setAdding] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<FormState>(emptyForm);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState("");
  const [sortKey, setSortKey] = useState<SortKey>("attendance");

  const maxPvpCount = useMemo(() => Math.max(1, ...players.map((p) => p.pvpCount)), [players]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    let list = players.filter((p) => (!q || p.name.toLowerCase().includes(q)) && (!roleFilter || p.role === roleFilter));
    list = [...list].sort((a, b) => {
      if (sortKey === "name") return a.name.localeCompare(b.name, "ru");
      if (sortKey === "salary") return b.salary - a.salary;
      if (sortKey === "attendancePrime") return b.attendancePctPrime - a.attendancePctPrime;
      if (sortKey === "attendanceMiniRb") return b.attendancePctMiniRb - a.attendancePctMiniRb;
      if (sortKey === "pvp") return b.pvpCount - a.pvpCount;
      return b.attendancePct - a.attendancePct;
    });
    return list;
  }, [players, search, roleFilter, sortKey]);

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
      salaryCoefficient: String(p.salaryCoefficient),
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
      salaryCoefficient: Number(form.salaryCoefficient),
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
        <div className="space-y-3">
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
                <label className="mb-1 block text-xs text-muted">Коэффициент</label>
                <input
                  type="number"
                  value={form.salaryCoefficient}
                  onChange={(e) => setForm((f) => ({ ...f, salaryCoefficient: e.target.value }))}
                  min={0}
                  max={1.25}
                  step={0.05}
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

      <div className="flex flex-col gap-3 rounded-lg border border-border bg-surface p-3 sm:flex-row sm:items-center">
        <div className="relative flex-1">
          <Search size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Поиск по нику…"
            className="w-full rounded-md border border-border bg-surface-2 py-2 pl-9 pr-3 text-sm outline-none focus:border-accent"
          />
        </div>
        <select
          value={roleFilter}
          onChange={(e) => setRoleFilter(e.target.value)}
          className="rounded-md border border-border bg-surface-2 px-3 py-2 text-sm outline-none focus:border-accent"
        >
          <option value="">Все роли</option>
          {ROLES.map((r) => (
            <option key={r} value={r}>
              {r}
            </option>
          ))}
        </select>
        <select
          value={sortKey}
          onChange={(e) => setSortKey(e.target.value as SortKey)}
          className="rounded-md border border-border bg-surface-2 px-3 py-2 text-sm outline-none focus:border-accent"
        >
          <option value="attendance">Сортировка: посещаемость</option>
          <option value="attendancePrime">Сортировка: Прайм</option>
          <option value="attendanceMiniRb">Сортировка: Мини-РБ</option>
          <option value="pvp">Сортировка: PvP</option>
          <option value="salary">Сортировка: зарплата</option>
          <option value="name">Сортировка: имя</option>
        </select>
      </div>

      {filtered.length === 0 ? (
        <div className="rounded-lg border border-border bg-surface">
          <EmptyState title="Никого не найдено" hint="Попробуйте изменить поиск или фильтр." />
        </div>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-border bg-surface">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border text-left text-xs uppercase tracking-wider text-muted">
                <th className="px-4 py-3 font-medium">Имя</th>
                <th className="px-4 py-3 font-medium">Роль</th>
                <th
                  className="px-4 py-3 font-medium"
                  title="П — доля активностей категории «Прайм», М — доля активностей категории «Мини-РБ», в которых участвовал игрок. PvP — число участий в активностях режима PvP (шкала относительно лучшего в гильдии)"
                >
                  Посещаемость
                </th>
                <th className="px-4 py-3 font-medium" title="Настраивается админом индивидуально для каждого игрока (0.0–1.25)">
                  Коэффициент
                </th>
                <th
                  className="px-4 py-3 font-medium"
                  title="П — доля Казны с Прайма, М — доля Казны мини-РБ, делится по посещаемости соответствующей категории с учётом коэффициента. Посещаемость ниже 20% по категории исключает из расчёта зарплаты за неё."
                >
                  Зарплата
                </th>
                {isAdmin && <th className="px-4 py-3 font-medium" />}
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {filtered.map((p) => {
                const isSelf = currentUserId !== null && p.userId === currentUserId;
                return (
                  <tr
                    key={p.id}
                    onClick={() => router.push(`/players/${p.id}`)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" || e.key === " ") {
                        e.preventDefault();
                        router.push(`/players/${p.id}`);
                      }
                    }}
                    role="button"
                    tabIndex={0}
                    aria-label={`Открыть профиль игрока ${p.name}`}
                    className={clsx(
                      "row-tint cursor-pointer transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent focus-visible:-outline-offset-2",
                      isSelf && "border-l-2 border-accent",
                    )}
                  >
                    <td className="px-4 py-3">
                      <Link
                        href={`/players/${p.id}`}
                        onClick={(e) => e.stopPropagation()}
                        className="font-medium hover:text-accent"
                      >
                        {p.name}
                      </Link>
                      {isSelf && (
                        <span className="ml-2 rounded-full border border-accent/40 px-1.5 py-0.5 text-[10px] font-medium text-accent">
                          это вы
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-muted">{p.role}</td>
                    <td className="px-4 py-3">
                      <BlurValue blurred={isRandom}>
                        <div className="space-y-1">
                          <div className="flex items-center gap-2">
                            <span className="w-3 flex-shrink-0 text-[10px] font-semibold text-muted" title="Прайм">
                              П
                            </span>
                            <div className="h-1.5 w-16 overflow-hidden rounded-full bg-surface-2">
                              <div
                                className={clsx("h-full rounded-full", attendanceColor(p.attendancePctPrime).bar)}
                                style={{ width: `${Math.min(p.attendancePctPrime, 100)}%` }}
                              />
                            </div>
                            <span className={clsx("text-xs font-medium", attendanceColor(p.attendancePctPrime).text)}>
                              {p.attendancePctPrime}%
                            </span>
                          </div>
                          <div className="flex items-center gap-2">
                            <span className="w-3 flex-shrink-0 text-[10px] font-semibold text-muted" title="Мини-РБ">
                              М
                            </span>
                            <div className="h-1.5 w-16 overflow-hidden rounded-full bg-surface-2">
                              <div
                                className={clsx("h-full rounded-full", attendanceColor(p.attendancePctMiniRb).bar)}
                                style={{ width: `${Math.min(p.attendancePctMiniRb, 100)}%` }}
                              />
                            </div>
                            <span className={clsx("text-xs font-medium", attendanceColor(p.attendancePctMiniRb).text)}>
                              {p.attendancePctMiniRb}%
                            </span>
                          </div>
                          <div className="flex items-center gap-2">
                            <span className="w-3 flex-shrink-0 text-[10px] font-semibold text-muted" title="PvP">
                              PvP
                            </span>
                            <div className="h-1.5 w-16 overflow-hidden rounded-full bg-surface-2">
                              <div
                                className="h-full rounded-full bg-info"
                                style={{ width: `${Math.min(100, (p.pvpCount / maxPvpCount) * 100)}%` }}
                              />
                            </div>
                            <span className="text-xs font-medium text-info">{p.pvpCount}</span>
                          </div>
                        </div>
                      </BlurValue>
                    </td>
                    <td className="px-4 py-3 text-muted">{coefficientFmt.format(p.salaryCoefficient)}</td>
                    <td className="px-4 py-3">
                      <BlurValue blurred={isRandom}>
                        <div className="space-y-1">
                          <div className="flex items-center gap-2">
                            <span className="w-3 flex-shrink-0 text-[10px] font-semibold text-muted" title="Прайм">
                              П
                            </span>
                            <span className="font-medium tabular-nums">{numberFmt.format(p.salaryPrime)}</span>
                          </div>
                          <div className="flex items-center gap-2">
                            <span className="w-3 flex-shrink-0 text-[10px] font-semibold text-muted" title="Мини-РБ">
                              М
                            </span>
                            <span className="font-medium tabular-nums">{numberFmt.format(p.salaryMiniRb)}</span>
                          </div>
                        </div>
                      </BlurValue>
                    </td>
                    {isAdmin && (
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              startEdit(p);
                            }}
                            aria-label="Редактировать"
                            className="rounded p-1.5 text-muted hover:bg-surface-2 hover:text-foreground"
                          >
                            <Pencil size={15} />
                          </button>
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleDelete(p.id);
                            }}
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
            </tbody>
          </table>
        </div>
      )}

    </div>
  );
}
