"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Lock, LockOpen } from "lucide-react";

/**
 * Кнопка «Зарплата»: фиксирует расчётные суммы всех игроков на день
 * выплаты (см. /api/payments/snapshot). После фиксации суммы в «Расчёте
 * распределения» и в кнопках «Выплата» берутся из снимка, а не
 * пересчитываются от остатка казны — иначе выплата одному игроку двигала
 * бы отображаемую сумму у всех остальных.
 */
export default function FreezeSalaryButton({ alreadyFrozen }: { alreadyFrozen: boolean }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (alreadyFrozen) {
    return (
      <span className="flex items-center gap-1.5 rounded-md border border-border bg-surface-2 px-3 py-2 text-xs text-muted">
        <Lock size={14} className="text-success" />
        Зарплата зафиксирована на этот период
      </span>
    );
  }

  async function handleClick() {
    if (
      !confirm(
        "Зафиксировать расчётные суммы всех игроков на текущий период? После этого суммы перестанут " +
          "пересчитываться от остатка казны — выплата одному игроку не будет двигать суммы остальных."
      )
    ) {
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/payments/snapshot", { method: "POST" });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error ?? "Не удалось зафиксировать зарплату.");
        return;
      }
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex items-center gap-2">
      <button
        type="button"
        onClick={handleClick}
        disabled={busy}
        className="flex items-center gap-1.5 rounded-md bg-accent px-3 py-2 text-sm font-medium text-black hover:opacity-90 disabled:opacity-60"
      >
        <LockOpen size={15} />
        Зарплата
      </button>
      {error && <p className="text-xs text-danger">{error}</p>}
    </div>
  );
}
