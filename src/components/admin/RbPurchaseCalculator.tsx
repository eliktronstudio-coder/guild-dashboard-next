"use client";

import { useMemo, useState } from "react";
import { Search } from "lucide-react";
import EmptyState from "@/components/EmptyState";
import { useDesignText } from "@/components/design/DesignTextProvider";

type Player = {
  id: string;
  name: string;
  role: string;
  attendancePct: number;
  salaryCoefficient: number;
};

const numberFmt = new Intl.NumberFormat("ru-RU");

/**
 * Делит целое количество опыта пропорционально весам методом наибольшего
 * остатка: сначала всем достаётся целая часть доли, затем оставшиеся
 * единицы уходят тем, у кого дробный хвост больше. Обычное округление
 * каждой доли по отдельности давало бы сумму, не совпадающую с введённым
 * опытом (при большом составе расхождение — десятки единиц).
 */
function splitProportionally<T>(items: { item: T; weight: number }[], total: number) {
  const totalWeight = items.reduce((sum, i) => sum + i.weight, 0);
  if (totalWeight <= 0 || total <= 0) {
    return items.map((i) => ({ item: i.item, weight: i.weight, sharePct: 0, amount: 0 }));
  }

  const exact = items.map((i) => {
    const value = (i.weight / totalWeight) * total;
    const floor = Math.floor(value);
    return { item: i.item, weight: i.weight, sharePct: (i.weight / totalWeight) * 100, floor, frac: value - floor };
  });

  let rest = total - exact.reduce((sum, e) => sum + e.floor, 0);
  const byFrac = [...exact].sort((a, b) => b.frac - a.frac);
  const bonus = new Map<number, number>();
  for (let i = 0; i < byFrac.length && rest > 0; i++, rest--) {
    bonus.set(exact.indexOf(byFrac[i]), 1);
  }

  return exact.map((e, idx) => ({
    item: e.item,
    weight: e.weight,
    sharePct: e.sharePct,
    amount: e.floor + (bonus.get(idx) ?? 0),
  }));
}

export default function RbPurchaseCalculator({ players }: { players: Player[] }) {
  const title = useDesignText("rbPurchase.title", "Расчёт покупки РБ");
  const subtitle = useDesignText(
    "rbPurchase.subtitle",
    "Выберите участников и укажите объём купленного РБ опыта — он разделится между выбранными пропорционально их посещаемости Мини-РБ (с учётом индивидуального коэффициента, как в расчёте зарплаты). В списке только игроки с посещаемостью Мини-РБ от 20%."
  );
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [xpAmount, setXpAmount] = useState("");

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
    const totalXp = Math.max(0, Math.round(Number(xpAmount) || 0));

    // Та же логика, что и в расчёте зарплаты: доля пропорциональна
    // посещаемости Мини-РБ, скорректированной индивидуальным коэффициентом.
    const weighted = participants.map((p) => ({ item: p, weight: p.attendancePct * p.salaryCoefficient }));
    const totalWeight = weighted.reduce((sum, w) => sum + w.weight, 0);

    const shares = splitProportionally(weighted, totalXp)
      .map((s) => ({ player: s.item, sharePct: s.sharePct, xp: s.amount }))
      .sort((a, b) => b.xp - a.xp);

    return { totalXp, totalWeight, shares };
  }, [players, selected, xpAmount]);

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
          <p className="text-xs text-muted-2">Выбрано участников: {selected.size}</p>
        </div>

        <div className="rounded-lg border border-border bg-surface p-4">
          <h2 className="mb-2 text-sm font-semibold">Разбивка по участникам</h2>
          {result.shares.length === 0 ? (
            <EmptyState title="Никто не выбран" hint="Отметьте игроков в списке слева." />
          ) : result.totalWeight === 0 ? (
            <p className="text-sm text-muted">
              У выбранных участников посещаемость Мини-РБ 0% — распределить опыт пропорционально нечем.
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
