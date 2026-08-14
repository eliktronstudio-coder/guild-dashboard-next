"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { Plus, Trash2, X, Settings } from "lucide-react";

const numberFmt = new Intl.NumberFormat("ru-RU");

type Transaction = {
  id: string;
  description: string;
  amount: number;
  date: string;
};

type Settings = {
  raidDropGoldEquivalent: number;
  nextPayoutDate: string | null;
};

function todayISO() {
  return new Date().toISOString().slice(0, 10);
}

export default function TreasuryPanel({
  transactions,
  settings,
  isAdmin,
}: {
  transactions: Transaction[];
  settings: Settings;
  isAdmin: boolean;
}) {
  const router = useRouter();
  const [adding, setAdding] = useState(false);
  const [editingSettings, setEditingSettings] = useState(false);
  const [description, setDescription] = useState("");
  const [amount, setAmount] = useState("");
  const [date, setDate] = useState(todayISO());
  const [raidDrop, setRaidDrop] = useState(String(settings.raidDropGoldEquivalent));
  const [payoutDate, setPayoutDate] = useState(settings.nextPayoutDate?.slice(0, 10) ?? "");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function handleAddTransaction(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      const res = await fetch("/api/treasury/transactions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ description, amount: Number(amount), date }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Что-то пошло не так.");
        setBusy(false);
        return;
      }
      setAdding(false);
      setDescription("");
      setAmount("");
      setDate(todayISO());
      router.refresh();
    } catch {
      setError("Не удалось связаться с сервером.");
    } finally {
      setBusy(false);
    }
  }

  async function handleSaveSettings(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      const res = await fetch("/api/settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ raidDropGoldEquivalent: Number(raidDrop), nextPayoutDate: payoutDate || null }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Что-то пошло не так.");
        setBusy(false);
        return;
      }
      setEditingSettings(false);
      router.refresh();
    } catch {
      setError("Не удалось связаться с сервером.");
    } finally {
      setBusy(false);
    }
  }

  async function handleDelete(id: string) {
    if (!confirm("Удалить операцию?")) return;
    setBusy(true);
    await fetch(`/api/treasury/transactions/${id}`, { method: "DELETE" });
    setBusy(false);
    router.refresh();
  }

  if (!isAdmin) {
    return (
      <div className="rounded-lg border border-border bg-surface">
        <div className="border-b border-border p-4">
          <h2 className="text-sm font-semibold">Последние операции</h2>
        </div>
        <TransactionList transactions={transactions} />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2">
        {!adding && (
          <button
            type="button"
            onClick={() => setAdding(true)}
            className="flex items-center gap-2 rounded-md bg-accent px-3 py-2 text-sm font-medium text-black hover:opacity-90"
          >
            <Plus size={16} /> Добавить операцию
          </button>
        )}
        {!editingSettings && (
          <button
            type="button"
            onClick={() => setEditingSettings(true)}
            className="flex items-center gap-2 rounded-md border border-border px-3 py-2 text-sm text-foreground/80 hover:bg-surface-2 hover:text-foreground"
          >
            <Settings size={16} /> Настройки казны
          </button>
        )}
      </div>

      {editingSettings && (
        <form
          onSubmit={handleSaveSettings}
          className="grid grid-cols-1 gap-3 rounded-lg border border-border bg-surface p-4 sm:grid-cols-3"
        >
          <div>
            <label className="mb-1 block text-xs text-muted">Дроп с РБ (золота)</label>
            <input
              type="number"
              value={raidDrop}
              onChange={(e) => setRaidDrop(e.target.value)}
              min={0}
              required
              className="w-full rounded-md border border-border bg-surface-2 px-3 py-2 text-sm outline-none focus:border-accent"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs text-muted">Дата следующей выплаты</label>
            <input
              type="date"
              value={payoutDate}
              onChange={(e) => setPayoutDate(e.target.value)}
              className="w-full rounded-md border border-border bg-surface-2 px-3 py-2 text-sm outline-none focus:border-accent"
            />
          </div>
          <div className="flex items-end gap-2">
            <button
              type="submit"
              disabled={busy}
              className="rounded-md bg-accent px-3 py-2 text-sm font-medium text-black hover:opacity-90 disabled:opacity-60"
            >
              Сохранить
            </button>
            <button
              type="button"
              onClick={() => setEditingSettings(false)}
              className="flex items-center gap-1 rounded-md border border-border px-3 py-2 text-sm text-muted hover:text-foreground"
            >
              <X size={14} /> Отмена
            </button>
          </div>
        </form>
      )}

      {adding && (
        <form
          onSubmit={handleAddTransaction}
          className="grid grid-cols-1 gap-3 rounded-lg border border-border bg-surface p-4 sm:grid-cols-4"
        >
          <div className="sm:col-span-2">
            <label className="mb-1 block text-xs text-muted">Описание</label>
            <input
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              required
              maxLength={100}
              className="w-full rounded-md border border-border bg-surface-2 px-3 py-2 text-sm outline-none focus:border-accent"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs text-muted">Сумма (+/-)</label>
            <input
              type="number"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              required
              className="w-full rounded-md border border-border bg-surface-2 px-3 py-2 text-sm outline-none focus:border-accent"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs text-muted">Дата</label>
            <input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              required
              className="w-full rounded-md border border-border bg-surface-2 px-3 py-2 text-sm outline-none focus:border-accent"
            />
          </div>

          {error && <p className="text-xs text-danger sm:col-span-4">{error}</p>}

          <div className="flex items-center gap-2 sm:col-span-4">
            <button
              type="submit"
              disabled={busy}
              className="rounded-md bg-accent px-3 py-2 text-sm font-medium text-black hover:opacity-90 disabled:opacity-60"
            >
              Добавить
            </button>
            <button
              type="button"
              onClick={() => setAdding(false)}
              className="flex items-center gap-1 rounded-md border border-border px-3 py-2 text-sm text-muted hover:text-foreground"
            >
              <X size={14} /> Отмена
            </button>
          </div>
        </form>
      )}

      {error && !adding && !editingSettings && <p className="text-xs text-danger">{error}</p>}

      <div className="rounded-lg border border-border bg-surface">
        <div className="border-b border-border p-4">
          <h2 className="text-sm font-semibold">Последние операции</h2>
        </div>
        <TransactionList transactions={transactions} onDelete={handleDelete} />
      </div>
    </div>
  );
}

function TransactionList({
  transactions,
  onDelete,
}: {
  transactions: Transaction[];
  onDelete?: (id: string) => void;
}) {
  return (
    <ul className="divide-y divide-border">
      {transactions.map((t) => (
        <li key={t.id} className="flex items-center justify-between px-4 py-3 text-sm">
          <span>{t.description}</span>
          <span className="flex items-center gap-3">
            <span className={t.amount >= 0 ? "text-success" : "text-danger"}>
              {t.amount >= 0 ? "+" : ""}
              {numberFmt.format(t.amount)}
            </span>
            <span className="text-xs text-muted">{t.date}</span>
            {onDelete && (
              <button
                type="button"
                onClick={() => onDelete(t.id)}
                aria-label="Удалить"
                className="rounded p-1 text-muted hover:bg-surface-2 hover:text-danger"
              >
                <Trash2 size={14} />
              </button>
            )}
          </span>
        </li>
      ))}
      {transactions.length === 0 && (
        <li className="px-4 py-6 text-center text-muted">Пока нет операций.</li>
      )}
    </ul>
  );
}
