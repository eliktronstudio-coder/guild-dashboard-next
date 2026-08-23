"use client";

import { useMemo, useState } from "react";
import { RANK_LABELS, RB_GEAR_ROWS } from "@/lib/rbGearData";

const numberFmt = new Intl.NumberFormat("ru-RU");

export default function GearRankCalculator() {
  const [itemIndex, setItemIndex] = useState(0);
  const [currentRank, setCurrentRank] = useState(0);
  const [targetRank, setTargetRank] = useState(RANK_LABELS.length - 1);
  const [showTable, setShowTable] = useState(false);

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
    return { total, steps };
  }, [item, currentRank, targetRank]);

  return (
    <div className="space-y-4 rounded-lg border border-border bg-surface p-4">
      <h2 className="text-sm font-semibold">Калькулятор прокачки РБ экипировки</h2>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="space-y-4">
          <label className="block text-xs text-muted">
            Экипировка
            <select
              value={itemIndex}
              onChange={(e) => setItemIndex(Number(e.target.value))}
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
