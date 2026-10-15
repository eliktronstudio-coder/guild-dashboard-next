"use client";

import { useMemo, useState } from "react";
import { Search, X } from "lucide-react";
import EmptyState from "@/components/EmptyState";
import { useDesignText } from "@/components/design/DesignTextProvider";
import { splitProportionally } from "@/lib/proportionalSplit";

type Player = {
  id: string;
  name: string;
  role: string;
  /** Для подсказки при добавлении — реальную долю всё равно задают вручную. */
  attendancePctMiniRb: number;
};

const numberFmt = new Intl.NumberFormat("ru-RU");

export default function RbPurchaseCalculator({ players }: { players: Player[] }) {
  const title = useDesignText("rbPurchase.title", "Расчёт покупки РБ");
  const subtitle = useDesignText(
    "rbPurchase.subtitle",
    "Выберите ник из состава и укажите его долю вручную — опыт разделится между добавленными участниками пропорционально указанным процентам."
  );
  const [search, setSearch] = useState("");
  // playerId -> введённый вручную процент (строкой, чтобы не терять ввод "").
  const [entries, setEntries] = useState<Map<string, string>>(new Map());
  const [xpAmount, setXpAmount] = useState("");

  const byId = useMemo(() => new Map(players.map((p) => [p.id, p])), [players]);

  const suggestions = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return [];
    return players.filter((p) => !entries.has(p.id) && p.name.toLowerCase().includes(q)).slice(0, 8);
  }, [players, search, entries]);

  function addPlayer(p: Player) {
    setEntries((prev) => {
      const next = new Map(prev);
      // Подсказываем реальной посещаемостью Мини-РБ как стартовым значением —
      // админ тут же может поправить его под фактическую договорённость.
      next.set(p.id, String(p.attendancePctMiniRb));
      return next;
    });
    setSearch("");
  }

  function removePlayer(id: string) {
    setEntries((prev) => {
      const next = new Map(prev);
      next.delete(id);
      return next;
    });
  }

  function setPct(id: string, value: string) {
    setEntries((prev) => new Map(prev).set(id, value));
  }

  function clearAll() {
    setEntries(new Map());
  }

  const result = useMemo(() => {
    const totalXp = Math.max(0, Math.round(Number(xpAmount) || 0));

    const weighted = [...entries.entries()]
      .map(([id, pctStr]) => {
        const player = byId.get(id);
        const pct = Math.max(0, Number(pctStr) || 0);
        return player ? { item: player, weight: pct } : null;
      })
      .filter((w): w is { item: Player; weight: number } => w !== null);

    const totalWeight = weighted.reduce((sum, w) => sum + w.weight, 0);

    const shares = splitProportionally(weighted, totalXp)
      .map((s) => ({ player: s.item, enteredPct: s.weight, sharePct: s.sharePct, xp: s.amount }))
      .sort((a, b) => b.xp - a.xp);

    return { totalXp, totalWeight, shares };
  }, [entries, byId, xpAmount]);

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-lg font-semibold">{title}</h1>
        <p className="text-sm text-muted">{subtitle}</p>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <div className="space-y-3 rounded-lg border border-border bg-surface p-4">
          <label className="block text-xs text-muted">
            Опыт РБ, ед.
            <input
              type="number"
              min={0}
              value={xpAmount}
              onChange={(e) => setXpAmount(e.target.value)}
              placeholder="0"
              className="mt-1 w-full rounded-md border border-border bg-surface-2 px-3 py-2 text-sm text-foreground outline-none focus:border-accent"
            />
          </label>
          <div className="flex items-baseline justify-between rounded-md bg-surface-2 px-3 py-2.5">
            <span className="text-xs text-muted">К распределению</span>
            <span className="font-mono text-lg font-semibold text-accent-bright">
              {numberFmt.format(result.totalXp)} опыта
            </span>
          </div>
          <p className="text-xs text-muted-2">Добавлено участников: {entries.size}</p>
        </div>

        <div className="rounded-lg border border-border bg-surface p-4">
          <h2 className="mb-2 text-sm font-semibold">Разбивка по участникам</h2>
          {result.shares.length === 0 ? (
            <EmptyState title="Никто не добавлен" hint="Найдите ник в составе ниже и добавьте его." />
          ) : result.totalWeight === 0 ? (
            <p className="text-sm text-muted">У всех добавленных участников доля 0% — распределять нечем.</p>
          ) : (
            <ul className="max-h-[280px] space-y-1 overflow-y-auto text-sm">
              {result.shares.map((s) => (
                <li key={s.player.id} className="flex items-center justify-between rounded-md px-2 py-1.5 hover:bg-surface-2">
                  <span className="min-w-0 truncate">{s.player.name}</span>
                  <span className="flex flex-shrink-0 items-center gap-3">
                    <span className="font-mono text-xs text-muted">{s.enteredPct}%</span>
                    <span className="w-14 text-right font-mono text-xs text-muted">{s.sharePct.toFixed(1)}%</span>
                    <span className="w-24 text-right font-mono font-semibold tabular-nums">
                      {numberFmt.format(s.xp)}
                    </span>
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      <div className="rounded-lg border border-border bg-surface">
        <div className="relative border-b border-border p-3">
          <Search size={14} className="pointer-events-none absolute left-6 top-1/2 -translate-y-1/2 text-muted" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Найти ник в составе и добавить…"
            className="w-full rounded-md border border-border bg-surface-2 py-1.5 pl-8 pr-3 text-sm outline-none focus:border-accent"
          />
          {suggestions.length > 0 && (
            <ul className="absolute inset-x-3 top-full z-10 mt-1 max-h-60 overflow-y-auto rounded-md border border-border bg-surface shadow-lg">
              {suggestions.map((p) => (
                <li key={p.id}>
                  <button
                    type="button"
                    onClick={() => addPlayer(p)}
                    className="flex w-full items-center justify-between gap-3 px-3 py-2 text-left text-sm hover:bg-surface-2"
                  >
                    <span className="min-w-0 flex-1 truncate font-medium">{p.name}</span>
                    <span className="text-xs text-muted">{p.role}</span>
                    <span className="font-mono text-xs text-muted-2">Мини-РБ {p.attendancePctMiniRb}%</span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>

        {entries.size === 0 ? (
          <EmptyState title="Состав для расчёта пуст" hint="Найдите игрока в поиске выше и добавьте его." />
        ) : (
          <>
            <div className="flex justify-end border-b border-border p-2">
              <button
                type="button"
                onClick={clearAll}
                className="rounded-md border border-border px-2.5 py-1 text-xs text-foreground/80 hover:bg-surface-2 hover:text-foreground"
              >
                Очистить список
              </button>
            </div>
            <ul className="divide-y divide-border">
              {[...entries.keys()].map((id) => {
                const p = byId.get(id);
                if (!p) return null;
                return (
                  <li key={id} className="flex items-center gap-3 px-4 py-2.5 text-sm">
                    <span className="min-w-0 flex-1 truncate font-medium">{p.name}</span>
                    <span className="w-16 flex-shrink-0 text-right text-xs text-muted">{p.role}</span>
                    <label className="flex flex-shrink-0 items-center gap-1.5">
                      <input
                        type="number"
                        min={0}
                        max={100}
                        value={entries.get(id) ?? ""}
                        onChange={(e) => setPct(id, e.target.value)}
                        className="w-16 rounded-md border border-border bg-surface-2 px-2 py-1 text-right text-sm outline-none focus:border-accent"
                      />
                      <span className="text-xs text-muted">%</span>
                    </label>
                    <button
                      type="button"
                      onClick={() => removePlayer(id)}
                      aria-label="Убрать"
                      className="flex-shrink-0 text-muted hover:text-danger"
                    >
                      <X size={15} />
                    </button>
                  </li>
                );
              })}
            </ul>
          </>
        )}
      </div>
    </div>
  );
}
