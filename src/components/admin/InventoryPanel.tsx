"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { Plus, Pencil, Check, X, Trash2, HelpCircle } from "lucide-react";
import clsx from "clsx";
import Drawer from "@/components/Drawer";
import AddDropForm from "./AddDropForm";

const numberFmt = new Intl.NumberFormat("ru-RU");

type Entry = { id: string; quantity: number; value: number; date: string; playerName: string | null };
type InventoryItem = {
  item: string;
  quantity: number;
  totalValue: number;
  imageUrl: string | null;
  entries: Entry[];
};

type ActivityOption = { id: string; name: string };
type PlayerOption = { id: string; name: string };
type CatalogItem = { id: string; name: string; price: number };

export default function InventoryPanel({
  items,
  activities,
  players,
  catalog,
  isAdmin,
}: {
  items: InventoryItem[];
  activities: ActivityOption[];
  players: PlayerOption[];
  catalog: CatalogItem[];
  isAdmin: boolean;
}) {
  const router = useRouter();
  const totalValue = items.reduce((sum, i) => sum + i.totalValue, 0);

  const [adding, setAdding] = useState(false);
  const [openItem, setOpenItem] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editQty, setEditQty] = useState("");
  const [editValue, setEditValue] = useState("");
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const active = items.find((i) => i.item === openItem) ?? null;

  function startEdit(e: Entry) {
    setEditingId(e.id);
    setEditQty(String(e.quantity));
    setEditValue(String(e.value));
    setError(null);
  }

  function cancelEdit() {
    setEditingId(null);
    setError(null);
  }

  async function saveEdit(id: string) {
    setBusyId(id);
    setError(null);
    const res = await fetch(`/api/drops/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ quantity: Number(editQty), value: Number(editValue) }),
    });
    const data = await res.json().catch(() => ({}));
    setBusyId(null);
    if (!res.ok) {
      setError(data.error ?? "Что-то пошло не так.");
      return;
    }
    setEditingId(null);
    router.refresh();
  }

  async function handleDelete(id: string) {
    if (!confirm("Удалить запись?")) return;
    setBusyId(id);
    await fetch(`/api/drops/${id}`, { method: "DELETE" });
    setBusyId(null);
    router.refresh();
  }

  return (
    <div className="space-y-3">
      <div className="rounded-lg border border-border bg-surface">
        <div className="flex items-center justify-between border-b border-border p-4">
          <h2 className="text-sm font-semibold">Инвентарь</h2>
          <div className="flex items-center gap-3">
            <span className="text-xs text-muted">{numberFmt.format(totalValue)} золота нераспределено</span>
            {isAdmin && !adding && (
              <button
                type="button"
                onClick={() => setAdding(true)}
                className="flex items-center gap-1.5 rounded-md border border-border px-2 py-1 text-xs text-foreground/80 hover:bg-surface-2 hover:text-foreground"
              >
                <Plus size={13} /> Добавить дроп
              </button>
            )}
          </div>
        </div>

        {isAdmin && adding && (
          <div className="p-4">
            <AddDropForm
              activities={activities}
              players={players}
              catalog={catalog}
              onSuccess={() => {
                setAdding(false);
                router.refresh();
              }}
              onCancel={() => setAdding(false)}
            />
          </div>
        )}

        {items.length === 0 ? (
          <p className="px-4 py-6 text-center text-sm text-muted">Пока нет непроданных предметов.</p>
        ) : (
          <div className="grid grid-cols-4 gap-3 p-4 sm:grid-cols-6 lg:grid-cols-8">
            {items.map((i) => (
              <button
                key={i.item}
                type="button"
                onClick={() => setOpenItem(i.item)}
                title={i.item}
                className="group relative flex aspect-square flex-col items-center justify-center rounded-lg border border-border bg-surface-2 transition-colors hover:border-accent/50 hover:bg-surface-hover"
              >
                {i.imageUrl ? (
                  <Image
                    src={i.imageUrl}
                    alt={i.item}
                    width={48}
                    height={48}
                    unoptimized
                    className="h-full w-full rounded-lg object-contain p-2"
                  />
                ) : (
                  <HelpCircle size={22} className="text-muted-2" />
                )}
                <span className="absolute -bottom-1.5 -right-1.5 flex h-5 min-w-5 items-center justify-center rounded-full border border-border bg-accent px-1 text-[11px] font-semibold text-black">
                  {i.quantity}
                </span>
              </button>
            ))}
          </div>
        )}
      </div>

      <Drawer open={!!active} onClose={() => setOpenItem(null)} title={active?.item ?? ""}>
        {active && (
          <div className="space-y-4">
            <div className="flex items-center gap-3 rounded-md border border-border bg-surface-2 p-3">
              {active.imageUrl ? (
                <Image
                  src={active.imageUrl}
                  alt={active.item}
                  width={40}
                  height={40}
                  unoptimized
                  className="h-10 w-10 flex-shrink-0 rounded object-contain"
                />
              ) : (
                <span className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded border border-border text-muted-2">
                  <HelpCircle size={18} />
                </span>
              )}
              <div>
                <p className="text-sm font-medium">
                  Всего: <span className="tabular-nums">{active.quantity}</span> шт.
                </p>
                <p className="text-xs text-accent">{numberFmt.format(active.totalValue)} золота</p>
              </div>
            </div>

            {error && <p className="text-xs text-danger">{error}</p>}

            <ul className="space-y-2">
              {active.entries.map((e) => (
                <li key={e.id} className="rounded-md border border-border bg-surface-2 p-3 text-sm">
                  {editingId === e.id ? (
                    <div className="space-y-2">
                      <div className="flex items-center gap-2">
                        <input
                          type="number"
                          min={1}
                          value={editQty}
                          onChange={(ev) => setEditQty(ev.target.value)}
                          className="w-20 rounded-md border border-border bg-surface px-2 py-1.5 text-sm outline-none focus:border-accent"
                        />
                        <span className="text-xs text-muted">×</span>
                        <input
                          type="number"
                          min={0}
                          value={editValue}
                          onChange={(ev) => setEditValue(ev.target.value)}
                          className="w-24 rounded-md border border-border bg-surface px-2 py-1.5 text-sm outline-none focus:border-accent"
                        />
                        <span className="text-xs text-muted">золота/ед.</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => saveEdit(e.id)}
                          disabled={busyId === e.id}
                          className="flex items-center gap-1 rounded-md bg-accent px-2 py-1 text-xs font-medium text-black hover:opacity-90 disabled:opacity-60"
                        >
                          <Check size={13} /> Сохранить
                        </button>
                        <button
                          type="button"
                          onClick={cancelEdit}
                          className="flex items-center gap-1 rounded-md border border-border px-2 py-1 text-xs text-muted hover:text-foreground"
                        >
                          <X size={13} /> Отмена
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="flex items-center justify-between gap-2">
                      <div>
                        <p>
                          ×{e.quantity} · {numberFmt.format(e.value)}/ед.
                          <span className="ml-2 text-accent">{numberFmt.format(e.value * e.quantity)} золота</span>
                        </p>
                        <p className="mt-0.5 text-xs text-muted">
                          {e.date}
                          {e.playerName && <> · {e.playerName}</>}
                        </p>
                      </div>
                      {isAdmin && (
                        <div className={clsx("flex items-center gap-1", busyId === e.id && "opacity-60")}>
                          <button
                            type="button"
                            onClick={() => startEdit(e)}
                            disabled={busyId === e.id}
                            aria-label="Редактировать"
                            className="rounded p-1.5 text-muted hover:bg-surface hover:text-foreground"
                          >
                            <Pencil size={14} />
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDelete(e.id)}
                            disabled={busyId === e.id}
                            aria-label="Удалить"
                            className="rounded p-1.5 text-muted hover:bg-surface hover:text-danger"
                          >
                            <Trash2 size={14} />
                          </button>
                        </div>
                      )}
                    </div>
                  )}
                </li>
              ))}
            </ul>
          </div>
        )}
      </Drawer>
    </div>
  );
}
