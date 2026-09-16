"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

const numberFmt = new Intl.NumberFormat("ru-RU");

export default function ClosePeriodButton() {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  async function handleClick() {
    setBusy(true);
    try {
      const summaryRes = await fetch("/api/periods/close");
      const summary = await summaryRes.json().catch(() => null);
      if (!summaryRes.ok || !summary) {
        alert(summary?.error ?? "Не удалось получить сводку периода.");
        return;
      }
      if (summary.negativeBalance) {
        alert("Отрицательный баланс казны — сначала исправьте баланс, архивация недоступна.");
        return;
      }

      const message =
        `Архивировать период ${summary.period.label}?\n\n` +
        `Активностей: ${summary.activityCount}\n` +
        `Непроданного дропа в инвентаре: ${summary.unsoldDrops}\n` +
        `Казна Прайм: ${numberFmt.format(summary.treasuryPrime)}, Мини-РБ: ${numberFmt.format(summary.treasuryMiniRb)}\n` +
        `Игроков с долгом: ${summary.playersWithDebt}, на сумму ${numberFmt.format(summary.totalDebtIfClosedNow)}\n\n` +
        `После архивации активности, продажи и начисления периода станут доступны только для просмотра. ` +
        `Задолженность перейдёт в архив, казна не обнулится — сразу начнётся новый период.`;
      if (!confirm(message)) return;

      const res = await fetch("/api/periods/close", { method: "POST" });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        alert(data.error ?? "Не удалось архивировать период.");
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
      className="rounded-md border border-danger/40 bg-danger/10 px-3 py-2 text-sm font-medium text-danger hover:bg-danger/20 disabled:opacity-60"
    >
      Архивировать период
    </button>
  );
}
