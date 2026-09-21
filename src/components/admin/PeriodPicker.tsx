"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";

export type PeriodOption = { id: string; label: string; hasRoster: boolean };

/**
 * «Выплата за период» — выбор между текущим расчётным периодом и закрытыми
 * (архивными). Выбор живёт в строке адреса (?period=...), а не в состоянии
 * компонента: страница серверная, и данные за выбранный период должны
 * приходить с сервера, а не досчитываться в браузере.
 */
export default function PeriodPicker({
  current,
  archives,
  selected,
}: {
  /** Подпись текущего, ещё не закрытого периода. */
  current: string;
  archives: PeriodOption[];
  /** id выбранного архива либо null — текущий период. */
  selected: string | null;
}) {
  const router = useRouter();
  const params = useSearchParams();
  const [busy, setBusy] = useState(false);

  function choose(value: string) {
    setBusy(true);
    const next = new URLSearchParams(params.toString());
    if (value) next.set("period", value);
    else next.delete("period");
    router.push(next.size > 0 ? `/payments?${next}` : "/payments");
  }

  if (archives.length === 0) return null;

  return (
    <div className="flex flex-wrap items-center gap-3 rounded-lg border border-border bg-surface px-4 py-3">
      <label htmlFor="payout-period" className="text-sm font-medium">
        Выплата за период
      </label>
      <select
        id="payout-period"
        value={selected ?? ""}
        disabled={busy}
        onChange={(e) => choose(e.target.value)}
        className="rounded-md border border-border bg-surface-2 px-2.5 py-1.5 text-sm disabled:opacity-60"
      >
        <option value="">Текущий · {current}</option>
        {archives.map((a) => (
          <option key={a.id} value={a.id} disabled={!a.hasRoster}>
            {a.label}
            {a.hasRoster ? "" : " — состав не сохранён"}
          </option>
        ))}
      </select>
      {selected ? (
        <span className="text-xs text-muted">
          Закрытый период: суммы зафиксированы при архивации и не пересчитываются.
        </span>
      ) : null}
    </div>
  );
}
