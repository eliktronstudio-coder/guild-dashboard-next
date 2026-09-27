"use client";

import { useState } from "react";
import Link from "next/link";
import clsx from "clsx";
import AchievementIcon from "./AchievementIcon";
import { rarityStyle } from "./rarity";
import { DEFAULT_TIERS } from "@/lib/achievements/tiers";
import { pluralizeUnit } from "@/lib/achievements/units";
import type { AchievementState } from "@/lib/achievements/progress";

const numberFmt = new Intl.NumberFormat("ru-RU");

/**
 * Достижения в профиле игрока: суммарные очки, число взятых ступеней и до
 * трёх закреплённых цепочек.
 *
 * Игрок закрепляет их сам на своей странице; если он ничего не закрепил,
 * показываем три сильнейших — это честнее пустого места.
 */
export default function ProfileAchievements({
  playerId,
  items,
  totalPoints,
  earnedTiers,
  maxPoints,
  pinnedKeys,
  canEdit,
}: {
  playerId: string;
  items: AchievementState[];
  totalPoints: number;
  earnedTiers: number;
  maxPoints: number;
  /** Ключи, закреплённые самим игроком; null — ещё ничего не выбрано. */
  pinnedKeys: string[] | null;
  /** Может ли смотрящий редактировать закрепление (это его профиль). */
  canEdit: boolean;
}) {
  const [editing, setEditing] = useState(false);
  const [selected, setSelected] = useState<string[]>(pinnedKeys ?? []);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [savedKeys, setSavedKeys] = useState<string[] | null>(pinnedKeys);

  const earned = items.filter((i) => (i.progress?.level ?? 0) > 0);

  const displayed =
    savedKeys && savedKeys.length > 0
      ? savedKeys.map((k) => items.find((i) => i.key === k)).filter((i): i is AchievementState => !!i)
      : [...earned].sort((a, b) => (b.progress?.points ?? 0) - (a.progress?.points ?? 0)).slice(0, 3);

  function toggle(key: string) {
    setSelected((prev) => (prev.includes(key) ? prev.filter((k) => k !== key) : prev.length >= 3 ? prev : [...prev, key]));
  }

  async function save() {
    setSaving(true);
    setError(null);
    try {
      const res = await fetch(`/api/players/${playerId}/pinned-achievements`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ keys: selected }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Не удалось сохранить.");
        return;
      }
      setSavedKeys(selected);
      setEditing(false);
    } catch {
      setError("Сеть недоступна.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="rounded-lg border border-border bg-surface p-4">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="text-sm font-semibold">Достижения</h2>
        <div className="flex items-center gap-3">
          {canEdit && !editing && (
            <button type="button" onClick={() => setEditing(true)} className="text-xs text-accent hover:underline">
              Закрепить
            </button>
          )}
          <Link href="/achievements" className="text-xs text-accent hover:underline">
            Все достижения →
          </Link>
        </div>
      </div>

      <div className="mt-2 flex flex-wrap gap-4 text-sm">
        <span>
          <span className="text-muted">Очки: </span>
          <span className="font-mono font-medium tabular-nums">{numberFmt.format(totalPoints)}</span>
          <span className="text-xs text-muted"> из {numberFmt.format(maxPoints)}</span>
        </span>
        <span>
          <span className="text-muted">Ступеней: </span>
          <span className="font-mono font-medium tabular-nums">{earnedTiers}</span>
        </span>
      </div>

      {editing ? (
        <div className="mt-3 space-y-2">
          <p className="text-xs text-muted">Выберите до трёх достижений для профиля ({selected.length}/3).</p>
          {earned.length === 0 ? (
            <p className="text-xs text-muted">Пока нечего закреплять — нет ни одной ступени.</p>
          ) : (
            <div className="grid grid-cols-1 gap-1.5 sm:grid-cols-2">
              {earned.map((i) => (
                <label
                  key={i.key}
                  className={clsx(
                    "flex items-center gap-2 rounded-md border border-border bg-surface-2 px-2 py-1.5 text-xs",
                    selected.includes(i.key) && "border-accent"
                  )}
                >
                  <input
                    type="checkbox"
                    checked={selected.includes(i.key)}
                    onChange={() => toggle(i.key)}
                    disabled={!selected.includes(i.key) && selected.length >= 3}
                  />
                  <span className="truncate">{i.title}</span>
                </label>
              ))}
            </div>
          )}
          {error && <p className="text-xs text-red-500">{error}</p>}
          <div className="flex gap-2">
            <button
              type="button"
              disabled={saving}
              onClick={save}
              className="rounded-md bg-accent px-3 py-1 text-xs font-medium text-white disabled:opacity-50"
            >
              Сохранить
            </button>
            <button
              type="button"
              onClick={() => {
                setSelected(savedKeys ?? []);
                setEditing(false);
                setError(null);
              }}
              className="rounded-md border border-border px-3 py-1 text-xs hover:bg-surface-2"
            >
              Отмена
            </button>
          </div>
        </div>
      ) : displayed.length === 0 ? (
        <p className="mt-3 text-xs text-muted">Ступеней пока нет — они появятся с первыми заслугами.</p>
      ) : (
        <ul className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-3">
          {displayed.map((i) => {
            const tier = DEFAULT_TIERS[(i.progress?.level ?? 1) - 1];
            const style = rarityStyle(tier.rarity);
            return (
              <li
                key={i.key}
                className={clsx("flex items-center gap-2 rounded-md border bg-surface-2 p-2", style.border)}
              >
                <span className={clsx("flex-shrink-0", style.text)}>
                  <AchievementIcon name={i.icon} size={26} />
                </span>
                <span className="min-w-0">
                  <span className="block truncate text-xs font-medium">{i.title}</span>
                  <span className={clsx("block text-[11px] tabular-nums", style.text)}>
                    {tier.roman} · {numberFmt.format(i.progress?.value ?? 0)}{" "}
                    {pluralizeUnit(i.progress?.value ?? 0, i.unit)}
                  </span>
                </span>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
