"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function ArchivePayButton({
  periodId,
  playerId,
  category,
  remaining,
}: {
  periodId: string;
  playerId: string;
  category: "Прайм" | "Мини-РБ";
  remaining: number;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  if (remaining <= 0) {
    return <span className="text-xs text-muted-2">Погашено</span>;
  }

  async function handleClick() {
    const input = prompt(`Сумма к выплате (${category}), доступно ${remaining}:`, String(remaining));
    if (input === null) return;
    const amount = Math.round(Number(input));
    if (!Number.isFinite(amount) || amount <= 0 || amount > remaining) {
      alert(`Сумма должна быть от 1 до ${remaining}.`);
      return;
    }
    if (!confirm(`Списать ${amount} из текущей казны (${category}) и погасить долг игроку?`)) return;
    setBusy(true);
    try {
      const res = await fetch(`/api/archive/${periodId}/pay`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ playerId, category, amount }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        alert(data.error ?? "Не удалось выплатить.");
        return;
      }
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={busy}
      className="rounded border border-accent/40 bg-accent/10 px-2 py-1 text-xs font-medium text-accent hover:bg-accent/20 disabled:opacity-60"
    >
      Выплатить
    </button>
  );
}
