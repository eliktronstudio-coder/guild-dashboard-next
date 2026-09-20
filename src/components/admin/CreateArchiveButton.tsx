"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

const numberFmt = new Intl.NumberFormat("ru-RU");

function todayISO() {
  return new Date().toISOString().slice(0, 10);
}

export default function CreateArchiveButton() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState(todayISO());
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function reset() {
    setOpen(false);
    setDateFrom("");
    setDateTo(todayISO());
    setError(null);
  }

  async function handleCreate() {
    if (!dateFrom || !dateTo) {
      setError("Укажите обе даты.");
      return;
    }
    if (dateFrom > dateTo) {
      setError("Дата «с» не может быть позже даты «по».");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const previewRes = await fetch(`/api/archive?dateFrom=${dateFrom}&dateTo=${dateTo}`);
      const preview = await previewRes.json().catch(() => null);
      if (!previewRes.ok || !preview) {
        setError(preview?.error ?? "Не удалось получить сводку.");
        return;
      }

      const message =
        `Архивировать период ${dateFrom} — ${dateTo}?\n\n` +
        `Активностей попадёт в архив: ${preview.activityCount}\n` +
        `Операций казны попадёт в архив: ${preview.transactionCount}\n\n` +
        `Текущая казна — Прайм: ${numberFmt.format(preview.treasuryPrime)}, Мини-РБ: ${numberFmt.format(preview.treasuryMiniRb)}, Гильдии: ${numberFmt.format(preview.treasuryGuild)}.\n\n` +
        `После архивации эти активности и операции уйдут в архив, а баланс казны и статистика активностей на сайте начнут считаться заново с 0. Данные не удаляются — их можно посмотреть в архиве.`;
      if (!confirm(message)) return;

      const res = await fetch("/api/archive", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ dateFrom, dateTo }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error ?? "Не удалось создать архив.");
        return;
      }
      reset();
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="rounded-md bg-accent px-3 py-2 text-sm font-medium text-black hover:opacity-90"
      >
        Архив периода
      </button>
    );
  }

  return (
    <div className="rounded-lg border border-border bg-surface p-4">
      <p className="mb-3 text-sm font-semibold">Архивировать период</p>
      <div className="flex flex-wrap items-end gap-3">
        <div>
          <label className="mb-1 block text-xs text-muted">С</label>
          <input
            type="date"
            value={dateFrom}
            onChange={(e) => setDateFrom(e.target.value)}
            className="rounded-md border border-border bg-surface-2 px-3 py-2 text-sm outline-none focus:border-accent"
          />
        </div>
        <div>
          <label className="mb-1 block text-xs text-muted">По</label>
          <input
            type="date"
            value={dateTo}
            onChange={(e) => setDateTo(e.target.value)}
            className="rounded-md border border-border bg-surface-2 px-3 py-2 text-sm outline-none focus:border-accent"
          />
        </div>
        <button
          type="button"
          onClick={handleCreate}
          disabled={busy}
          className="rounded-md bg-accent px-3 py-2 text-sm font-medium text-black hover:opacity-90 disabled:opacity-60"
        >
          Создать архив
        </button>
        <button
          type="button"
          onClick={reset}
          disabled={busy}
          className="rounded-md border border-border px-3 py-2 text-sm text-muted hover:text-foreground"
        >
          Отмена
        </button>
      </div>
      {error && <p className="mt-2 text-xs text-danger">{error}</p>}
    </div>
  );
}
