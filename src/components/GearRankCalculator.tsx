"use client";

import { useEffect, useMemo, useState } from "react";
import { RANK_LABELS, RANK_COLORS, RB_GEAR_ROWS, buildRankScale } from "@/lib/rbGearData";

const numberFmt = new Intl.NumberFormat("ru-RU");

export default function GearRankCalculator() {
  const [itemIndex, setItemIndex] = useState(0);
  const [currentRank, setCurrentRank] = useState(0);
  const [targetRank, setTargetRank] = useState(RANK_LABELS.length - 1);
  const [pricePer1000, setPricePer1000] = useState(100);
  const [showTable, setShowTable] = useState(false);
  const [xpAmount, setXpAmount] = useState(0);

  const item = RB_GEAR_ROWS[itemIndex];

  const result = useMemo(() => {
    if (targetRank <= currentRank) return null;
    const steps = [];
    let total = 0;
    for (let i = currentRank + 1; i <= targetRank; i++) {
      const cost = item.costs[i];
      total += cost;
      steps.push({ rank: RANK_LABELS[i], cost });
    }
    const gold = (total / 1000) * pricePer1000;
    return { total, steps, gold };
  }, [item, currentRank, targetRank, pricePer1000]);

  const scale = useMemo(() => buildRankScale(item.costs), [item]);

  // Открытый верхний цвет не имеет границы, поэтому ползунку нужен свой
  // потолок — берём с запасом над последней известной границей.
  const maxXp = useMemo(() => {
    if (scale.length === 0) return 0;
    const last = scale[scale.length - 1];
    return Math.ceil((last.lower * 1.5 || 1000) / 100) * 100;
  }, [scale]);

  useEffect(() => {
    setXpAmount((v) => Math.min(v, maxXp));
  }, [maxXp]);

  const xpRank = useMemo(
    () => scale.find((r) => xpAmount >= r.lower && (r.upper === null || xpAmount <= r.upper)) ?? null,
    [scale, xpAmount]
  );
  const xpGold = (xpAmount / 1000) * pricePer1000;

  return (
    <div className="space-y-4 rounded-lg border border-border bg-surface p-4">
      <h2 className="text-sm font-semibold">Калькулятор прокачки РБ экипировки</h2>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="space-y-4">
          <label className="block text-xs text-muted">
            Экипировка
            <select
              value={itemIndex}
              onChange={(e) => {
                setItemIndex(Number(e.target.value));
                setXpAmount(0);
              }}
              className="mt-1 w-full rounded-md border border-border bg-surface-2 px-3 py-2 text-sm text-foreground outline-none focus:border-accent"
            >
              {RB_GEAR_ROWS.map((row, i) => (
                <option key={row.name} value={i}>
                  {row.name}
                </option>
              ))}
            </select>
          </label>

          <div className="grid grid-cols-2 gap-3">
            <label className="block text-xs text-muted">
              Текущий ранг
              <select
                value={currentRank}
                onChange={(e) => setCurrentRank(Number(e.target.value))}
                className="mt-1 w-full rounded-md border border-border bg-surface-2 px-3 py-2 text-sm text-foreground outline-none focus:border-accent"
              >
                {RANK_LABELS.map((label, i) => (
                  <option key={label} value={i}>
                    {label}
                  </option>
                ))}
              </select>
            </label>

            <label className="block text-xs text-muted">
              Целевой ранг
              <select
                value={targetRank}
                onChange={(e) => setTargetRank(Number(e.target.value))}
                className="mt-1 w-full rounded-md border border-border bg-surface-2 px-3 py-2 text-sm text-foreground outline-none focus:border-accent"
              >
                {RANK_LABELS.map((label, i) => (
                  <option key={label} value={i}>
                    {label}
                  </option>
                ))}
              </select>
            </label>
          </div>

          <label className="block text-xs text-muted">
            Цена РБ опыта, золота за 1000 ед.
            <input
              type="number"
              min={0}
              value={pricePer1000}
              onChange={(e) => setPricePer1000(Number(e.target.value))}
              className="mt-1 w-full rounded-md border border-border bg-surface-2 px-3 py-2 text-sm text-foreground outline-none focus:border-accent"
            />
          </label>
        </div>

        <div className="space-y-3">
          {result === null ? (
            <p className="text-sm text-muted">Выберите целевой ранг выше текущего.</p>
          ) : (
            <>
              <div className="flex items-baseline justify-between rounded-md bg-surface-2 px-3 py-2.5">
                <span className="text-xs text-muted">Итого опыта нужно</span>
                <span className="font-mono text-lg font-semibold text-accent">{numberFmt.format(result.total)} XP</span>
              </div>
              <div className="flex items-baseline justify-between rounded-md bg-surface-2 px-3 py-2.5">
                <span className="text-xs text-muted">Стоимость в золоте</span>
                <span className="font-mono text-lg font-semibold text-accent-bright">
                  {numberFmt.format(Math.round(result.gold))} золота
                </span>
              </div>
              <div className="max-h-[180px] space-y-1 overflow-y-auto text-sm">
                {result.steps.map((step) => (
                  <div key={step.rank} className="flex justify-between text-xs">
                    <span className="text-muted">{step.rank}</span>
                    <span className={step.cost === 0 ? "text-muted-2" : "text-foreground"}>
                      {step.cost === 0 ? "недоступно" : `${numberFmt.format(step.cost)} XP`}
                    </span>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      </div>

      <div>
        <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted">
          Шкала прокачки: {item.name}
        </h3>
        {scale.length === 0 ? (
          <p className="text-xs text-muted">Для этого предмета нет данных по опыту.</p>
        ) : (
          <div className="space-y-3 rounded-md border border-border p-3">
            <div className="relative">
              <div className="flex h-3 w-full overflow-hidden rounded-full border border-border">
                {scale.map((r) => (
                  <div
                    key={r.label}
                    title={r.label}
                    style={{
                      background: RANK_COLORS[r.label] ?? "#888",
                      flexGrow: (r.upper === null ? maxXp - r.lower : r.upper - r.lower + 1) || 1,
                    }}
                  />
                ))}
              </div>
              {/* Насечки на границах цветов — там, где ранг сменяется. */}
              {scale.slice(0, -1).map((r) => (
                <div
                  key={r.label}
                  aria-hidden="true"
                  className="pointer-events-none absolute top-0 h-3 w-px bg-black/30"
                  style={{ left: `${Math.min(100, ((r.upper ?? 0) / maxXp) * 100)}%` }}
                />
              ))}
              <input
                type="range"
                min={0}
                max={maxXp}
                step={1}
                value={xpAmount}
                onChange={(e) => setXpAmount(Number(e.target.value))}
                className="absolute inset-0 h-3 w-full cursor-pointer opacity-0"
              />
              <div
                aria-hidden="true"
                className="pointer-events-none absolute top-1/2 h-4 w-4 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-accent bg-white shadow"
                style={{ left: `${maxXp === 0 ? 0 : (xpAmount / maxXp) * 100}%` }}
              />
            </div>
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="font-mono text-sm text-foreground">{numberFmt.format(xpAmount)} XP</span>
              <span className="text-sm font-medium text-accent">{xpRank ? xpRank.label : "Обычный"}</span>
            </div>
            <div className="flex items-baseline justify-between rounded-md bg-surface-2 px-3 py-2.5">
              <span className="text-xs text-muted">Стоимость этого объёма опыта</span>
              <span className="font-mono text-lg font-semibold text-accent-bright">
                {numberFmt.format(Math.round(xpGold))} золота
              </span>
            </div>
            {xpRank && (
              <p className="text-xs text-muted">
                Диапазон «{xpRank.label}»: от {numberFmt.format(xpRank.lower)}{" "}
                {xpRank.upper === null ? "и выше" : `до ${numberFmt.format(xpRank.upper)}`}
              </p>
            )}
          </div>
        )}
      </div>

      <div>
        <button
          type="button"
          onClick={() => setShowTable((v) => !v)}
          className="text-xs text-accent hover:underline"
        >
          {showTable ? "Скрыть исходную таблицу" : "Показать исходную таблицу"}
        </button>
        {showTable && (
          <div className="mt-3 overflow-x-auto rounded-md border border-border">
            <table className="w-full min-w-[900px] text-xs">
              <thead>
                <tr className="border-b border-border bg-surface-2 text-left text-muted">
                  <th className="whitespace-nowrap px-2 py-2 font-medium">Экипировка</th>
                  {RANK_LABELS.map((label) => (
                    <th key={label} className="whitespace-nowrap px-2 py-2 text-right font-medium">
                      {label}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {RB_GEAR_ROWS.map((row) => (
                  <tr key={row.name}>
                    <td className="whitespace-nowrap px-2 py-1.5 text-foreground">{row.name}</td>
                    {row.costs.map((cost, i) => (
                      <td key={i} className="whitespace-nowrap px-2 py-1.5 text-right font-mono text-muted">
                        {cost === 0 ? "—" : numberFmt.format(cost)}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <p className="text-xs text-muted">
        Значения перенесены из таблицы гильдии вручную — если заметите неточность в какой-то ячейке, пришлите
        верное число и я поправлю.
      </p>
    </div>
  );
}
