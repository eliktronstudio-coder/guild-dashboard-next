"use client";

import { useMemo, useState } from "react";
import { Search } from "lucide-react";
import EmptyState from "@/components/EmptyState";

type Player = {
  id: string;
  name: string;
  role: string;
  attendancePct: number;
  salaryCoefficient: number;
};

const numberFmt = new Intl.NumberFormat("ru-RU");

export default function RbPurchaseCalculator({ players }: { players: Player[] }) {
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [xpAmount, setXpAmount] = useState("");
  const [pricePer1000, setPricePer1000] = useState("100");

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return q ? players.filter((p) => p.name.toLowerCase().includes(q)) : players;
  }, [players, search]);

  function toggle(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function selectAllFiltered() {
    setSelected((prev) => {
      const next = new Set(prev);
      for (const p of filtered) next.add(p.id);
      return next;
    });
  }

  function clearSelection() {
    setSelected(new Set());
  }

  const result = useMemo(() => {
    const participants = players.filter((p) => selected.has(p.id));
    const xp = Number(xpAmount) || 0;
    const price = Number(pricePer1000) || 0;
    const totalGold = (xp / 1000) * price;

    // Та же логика, что и в расчёте зарплаты: доля пропорциональна общей
    // посещаемости, скорректированной индивидуальным коэффициентом.
    const weights = participants.map((p) => ({
      player: p,
      weight: p.attendancePct * p.salaryCoefficient,
    }));
    const totalWeight = weights.reduce((sum, w) => sum + w.weight, 0);

    const shares = weights.map((w) => ({
      player: w.player,
      weight: w.weight,
      sharePct: totalWeight > 0 ? (w.weight / totalWeight) * 100 : 0,
      gold: totalWeight > 0 ? Math.round((w.weight / totalWeight) * totalGold) : 0,
    }));
    shares.sort((a, b) => b.gold - a.gold);

    return { totalGold, totalWeight, shares };
  }, [players, selected, xpAmount, pricePer1000]);

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-lg font-semibold">Расчёт покупки РБ</h1>
        <p className="text-sm text-muted">
          Выберите участников, укажите объём купленного РБ опыта — стоимость разделится между выбранными
          пропорционально их общей посещаемости (с учётом индивидуального коэффициента, как в расчёте зарплаты).
        </p>
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
          <label className="block text-xs text-muted">
            Цена опыта, золота за 1000 ед.
            <input
              type="number"
              min={0}
              value={pricePer1000}
              onChange={(e) => setPricePer1000(e.target.value)}
              className="mt-1 w-full rounded-md border border-border bg-surface-2 px-3 py-2 text-sm text-foreground outline-none focus:border-accent"
            />
          </label>
          <div className="flex items-baseline justify-between rounded-md bg-surface-2 px-3 py-2.5">
            <span className="text-xs text-muted">Общая стоимость</span>
            <span className="font-mono text-lg font-semibold text-accent-bright">
              {numberFmt.format(Math.round(result.totalGold))} золота
            </span>
          </div>
          <p className="text-xs text-muted-2">Выбрано участников: {selected.size}</p>
        </div>

        <div className="rounded-lg border border-border bg-surface p-4">
          <h2 className="mb-2 text-sm font-semibold">Разбивка по участникам</h2>
          {result.shares.length === 0 ? (
            <EmptyState title="Никто не выбран" hint="Отметьте игроков в списке слева." />
          ) : result.totalWeight === 0 ? (
            <p className="text-sm text-muted">
              У выбранных участников общая посещаемость 0% — распределить стоимость пропорционально нечем.
            </p>
          ) : (
            <ul className="max-h-[280px] space-y-1 overflow-y-auto text-sm">
              {result.shares.map((s) => (
                <li key={s.player.id} className="flex items-center justify-between rounded-md px-2 py-1.5 hover:bg-surface-2">
                  <span className="min-w-0 truncate">{s.player.name}</span>
                  <span className="flex flex-shrink-0 items-center gap-3">
                    <span className="font-mono text-xs text-muted">{s.player.attendancePct}%</span>
                    <span className="w-14 text-right font-mono text-xs text-muted">{s.sharePct.toFixed(1)}%</span>
                    <span className="w-24 text-right font-mono font-semibold tabular-nums">
                      {numberFmt.format(s.gold)}
                    </span>
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      <div className="rounded-lg border border-border bg-surface">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border p-3">
          <div className="relative flex-1 min-w-[200px]">
            <Search size={14} className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-muted" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Поиск по нику…"
              className="w-full rounded-md border border-border bg-surface-2 py-1.5 pl-8 pr-3 text-sm outline-none focus:border-accent"
            />
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={selectAllFiltered}
              className="rounded-md border border-border px-2.5 py-1.5 text-xs text-foreground/80 hover:bg-surface-2 hover:text-foreground"
            >
              Выбрать всех {search ? "(по поиску)" : ""}
            </button>
            <button
              type="button"
              onClick={clearSelection}
              className="rounded-md border border-border px-2.5 py-1.5 text-xs text-foreground/80 hover:bg-surface-2 hover:text-foreground"
            >
              Снять выбор
            </button>
          </div>
        </div>

        {filtered.length === 0 ? (
          <EmptyState title="Никого не найдено" hint="Попробуйте изменить поиск." />
        ) : (
          <ul className="max-h-[420px] divide-y divide-border overflow-y-auto">
            {filtered.map((p) => (
              <li key={p.id}>
                <label className="flex cursor-pointer items-center gap-3 px-4 py-2.5 text-sm hover:bg-surface-2">
                  <input
                    type="checkbox"
                    checked={selected.has(p.id)}
                    onChange={() => toggle(p.id)}
                    className="h-4 w-4 flex-shrink-0 accent-accent"
                  />
                  <span className="min-w-0 flex-1 truncate font-medium">{p.name}</span>
                  <span className="text-xs text-muted">{p.role}</span>
                  <span className="w-16 flex-shrink-0 text-right font-mono text-xs text-muted">
                    {p.attendancePct}%
                  </span>
                </label>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
