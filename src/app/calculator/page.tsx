"use client";

import { useMemo, useState } from "react";
import GearRankCalculator from "@/components/GearRankCalculator";

const numberFmt = new Intl.NumberFormat("ru-RU");

function levelFromXp(xp: number) {
  return Math.max(1, Math.floor(Math.sqrt(Math.max(xp, 0) / 300)));
}

function xpForLevel(level: number) {
  return level * level * 300;
}

export default function CalculatorPage() {
  const [currentXp, setCurrentXp] = useState(4975);
  const [xpPerKill, setXpPerKill] = useState(180);
  const [kills, setKills] = useState(10);

  const result = useMemo(() => {
    const gained = xpPerKill * kills;
    const total = currentXp + gained;
    const level = levelFromXp(total);
    const nextLevelXp = xpForLevel(level + 1);
    const remaining = Math.max(nextLevelXp - total, 0);
    return { gained, total, level, nextLevelXp, remaining };
  }, [currentXp, xpPerKill, kills]);

  return (
    <div className="space-y-4">
    <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
      <div className="space-y-4 rounded-lg border border-border bg-surface p-4">
        <h2 className="text-sm font-semibold">Калькулятор РБ опыта</h2>

        <label className="block text-xs text-muted">
          Текущий опыт
          <input
            type="number"
            value={currentXp}
            onChange={(e) => setCurrentXp(Number(e.target.value))}
            className="mt-1 w-full rounded-md border border-border bg-surface-2 px-3 py-2 text-sm text-foreground outline-none focus:border-accent"
          />
        </label>

        <label className="block text-xs text-muted">
          Опыт за убийство РБ
          <input
            type="number"
            value={xpPerKill}
            onChange={(e) => setXpPerKill(Number(e.target.value))}
            className="mt-1 w-full rounded-md border border-border bg-surface-2 px-3 py-2 text-sm text-foreground outline-none focus:border-accent"
          />
        </label>

        <label className="block text-xs text-muted">
          Количество РБ
          <input
            type="number"
            value={kills}
            onChange={(e) => setKills(Number(e.target.value))}
            className="mt-1 w-full rounded-md border border-border bg-surface-2 px-3 py-2 text-sm text-foreground outline-none focus:border-accent"
          />
        </label>
      </div>

      <div className="space-y-3 rounded-lg border border-border bg-surface p-4">
        <h2 className="text-sm font-semibold">Результат</h2>
        <div className="space-y-2 text-sm">
          <div className="flex justify-between">
            <span className="text-muted">Получено опыта</span>
            <span>{numberFmt.format(result.gained)} XP</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted">Итоговый опыт</span>
            <span>{numberFmt.format(result.total)} XP</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted">Итоговый уровень</span>
            <span className="font-semibold text-accent">{result.level}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted">До след. уровня</span>
            <span>{numberFmt.format(result.remaining)} XP</span>
          </div>
        </div>
        <p className="pt-2 text-xs text-muted">
          Формула приблизительная — уточним под реальные значения игры позже.
        </p>
      </div>
    </div>

    <GearRankCalculator />
    </div>
  );
}
