"use client";

import { useState } from "react";
import { DEFAULT_TIERS } from "@/lib/achievements/tiers";

const ROMANS = DEFAULT_TIERS.map((t) => t.roman);
const numberFmt = new Intl.NumberFormat("ru-RU");

type Preview = {
  currentPoints: number;
  currentTierCount: number;
  proposedPoints: number;
  proposedTierCount: number;
  pointsDelta: number;
  tierCountDelta: number;
  players: number;
};

/**
 * Пороги влияют сразу на всех игроков — поэтому перед сохранением всегда
 * считаем и показываем превью «что изменится», без промежуточного шага
 * сохранить-потом-проверить.
 */
export default function AchievementManagement({ initialThresholds }: { initialThresholds: number[] }) {
  const [values, setValues] = useState<string[]>(initialThresholds.map(String));
  const [preview, setPreview] = useState<Preview | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [saved, setSaved] = useState(false);

  function setValue(i: number, v: string) {
    setValues((prev) => prev.map((old, idx) => (idx === i ? v : old)));
    setPreview(null);
    setSaved(false);
  }

  async function runPreview(apply: boolean) {
    setError(null);
    setSaved(false);
    const thresholds = values.map((v) => Number(v));
    if (thresholds.some((n) => !Number.isFinite(n))) {
      setError("Все пороги должны быть числами.");
      return;
    }
    setBusy(true);
    try {
      const res = await fetch("/api/achievements/thresholds", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ thresholds, apply }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Не удалось посчитать превью.");
        return;
      }
      setPreview(data.preview);
      if (apply) setSaved(true);
    } catch {
      setError("Сеть недоступна.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="rounded-lg border border-border bg-surface px-4 py-3 text-sm">
      <p className="font-medium">Пороги ступеней</p>
      <p className="mt-1 text-muted">
        Редкость, очки и римские цифры ступеней не меняются — только то, сколько единиц нужно набрать. Сначала
        посчитайте превью, затем сохраняйте осознанно.
      </p>
      <div className="mt-3 flex flex-wrap gap-3">
        {values.map((v, i) => (
          <label key={i} className="flex flex-col gap-1 text-xs text-muted">
            Ступень {ROMANS[i]}
            <input
              type="number"
              min={1}
              value={v}
              onChange={(e) => setValue(i, e.target.value)}
              className="w-20 rounded-md border border-border bg-surface-2 px-2 py-1 text-sm text-foreground"
            />
          </label>
        ))}
      </div>

      {error && <p className="mt-2 text-sm text-red-500">{error}</p>}

      {preview && (
        <div className="mt-3 rounded-md border border-border bg-surface-2 px-3 py-2 text-xs">
          <p>Игроков учтено: {preview.players}</p>
          <p>
            Очки гильдии: {numberFmt.format(preview.currentPoints)} → {numberFmt.format(preview.proposedPoints)} (
            {preview.pointsDelta >= 0 ? "+" : ""}
            {numberFmt.format(preview.pointsDelta)})
          </p>
          <p>
            Ступеней получено: {preview.currentTierCount} → {preview.proposedTierCount} (
            {preview.tierCountDelta >= 0 ? "+" : ""}
            {preview.tierCountDelta})
          </p>
        </div>
      )}

      {saved && <p className="mt-2 text-sm text-emerald-500">Пороги сохранены.</p>}

      <div className="mt-3 flex gap-2">
        <button
          type="button"
          disabled={busy}
          onClick={() => runPreview(false)}
          className="rounded-md border border-border px-3 py-1.5 text-sm hover:bg-surface-2 disabled:opacity-50"
        >
          Посчитать превью
        </button>
        <button
          type="button"
          disabled={busy || !preview}
          onClick={() => runPreview(true)}
          className="rounded-md bg-accent px-3 py-1.5 text-sm font-medium text-white disabled:opacity-50"
        >
          Сохранить
        </button>
      </div>
    </div>
  );
}
