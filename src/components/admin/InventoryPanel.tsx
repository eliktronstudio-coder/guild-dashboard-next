"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { Plus, Pencil, Check, X, Trash2, HelpCircle, ArrowRightLeft, Undo2 } from "lucide-react";
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
type TransferTarget = { value: string; label: string };

export default function InventoryPanel({
  title,
  items,
  activities,
  players,
  catalog,
  isAdmin,
  showAddButton = false,
  transferTargets = [],
}: {
  title: string;
  items: InventoryItem[];
  activities: ActivityOption[];
  players: PlayerOption[];
  catalog: CatalogItem[];
  isAdmin: boolean;
  showAddButton?: boolean;
  transferTargets?: TransferTarget[];
}) {
  const router = useRouter();
  const totalValue = items.reduce((sum, i) => sum + i.totalValue, 0);

  const [adding, setAdding] = useState(false);
  const [openItem, setOpenItem] = useState<string | null>(null);
  const [transferQty, setTransferQty] = useState(1);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editQty, setEditQty] = useState("");
  const [editValue, setEditValue] = useState("");
  const [busyId, setBusyId] = useState<string | null>(null);
  const [transferring, setTransferring] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const active = items.find((i) => i.item === openItem) ?? null;
  const isGeneral = transferTargets.length > 0;

  function openDrawer(i: InventoryItem) {
    setOpenItem(i.item);
    setTransferQty(i.quantity);
    setError(null);
  }

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
    const message = isGeneral ? "Удалить запись?" : "Вернуть предмет в Общий инвентарь?";
    if (!confirm(message)) return;
    setBusyId(id);
    await fetch(`/api/drops/${id}`, { method: "DELETE" });
    setBusyId(null);
    router.refresh();
  }

  function handleTransferQtyChange(value: string) {
    const max = active?.quantity ?? 1;
    const n = Math.round(Number(value));
    if (!Number.isFinite(n)) return;
    setTransferQty(Math.min(max, Math.max(1, n)));
  }

  async function handleTransfer(warehouse: string) {
    if (!active) return;
    setTransferring(true);
    setError(null);
    const res = await fetch("/api/drops/transfer", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ entryIds: active.entries.map((e) => e.id), warehouse, quantity: transferQty }),
    });
    const data = await res.json().catch(() => ({}));
    setTransferring(false);
    if (!res.ok) {
      setError(data.error ?? "Что-то пошло не так.");
      return;
    }
    setOpenItem(null);
    router.refresh();
  }

  return (
    <div className="space-y-3">
      <div className="rounded-lg border border-border bg-surface">
        <div className="flex items-center justify-between border-b border-border p-4">
          <h2 className="text-sm font-semibold">{title}</h2>
          <div className="flex items-center gap-3">
            <span className="text-xs text-muted">{numberFmt.format(totalValue)} золота нераспределено</span>
            {isAdmin && showAddButton && !adding && (
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

        {isAdmin && showAddButton && adding && (
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
          <div className="flex flex-wrap gap-2 p-4">
            {items.map((i) => (
              <button
                key={i.item}
                type="button"
                onClick={() => openDrawer(i)}
                title={i.item}
                className="group relative flex h-11 w-11 flex-shrink-0 flex-col items-center justify-center rounded-md border border-border bg-surface-2 transition-colors hover:border-accent/50 hover:bg-surface-hover"
              >
                {i.imageUrl ? (
                  <Image
                    src={i.imageUrl}
                    alt={i.item}
                    width={20}
                    height={20}
                    unoptimized
                    className="h-full w-full rounded-md object-contain p-1"
                  />
                ) : (
                  <HelpCircle size={13} className="text-muted-2" />
                )}
                <span className="absolute -bottom-1 -right-1 flex h-3.5 min-w-3.5 items-center justify-center rounded-full border border-border bg-accent px-0.5 text-[8px] font-semibold text-black">
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

            {isAdmin && transferTargets.length > 0 && (
              <div className="space-y-2 rounded-md border border-border p-3">
                <div className="flex items-center gap-2">
                  <span className="flex items-center gap-1 text-xs text-muted">
                    <ArrowRightLeft size={13} /> Перенести
                  </span>
                  <input
                    type="number"
                    value={transferQty}
                    onChange={(e) => handleTransferQtyChange(e.target.value)}
                    min={1}
                    max={active.quantity}
                    disabled={transferring}
                    className="w-16 rounded-md border border-border bg-surface-2 px-2 py-1 text-xs outline-none focus:border-accent disabled:opacity-60"
                  />
                  <span className="text-xs text-muted">из {active.quantity} шт. в:</span>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  {transferTargets.map((t) => (
                    <button
                      key={t.value}
                      type="button"
                      onClick={() => handleTransfer(t.value)}
                      disabled={transferring}
                      className="rounded-md border border-border px-2 py-1 text-xs text-foreground/80 hover:bg-surface-2 hover:text-foreground disabled:opacity-60"
                    >
                      {t.label}
                    </button>
                  ))}
                </div>
              </div>
            )}

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
                            aria-label={isGeneral ? "Удалить" : "Вернуть в Общий инвентарь"}
                            className="rounded p-1.5 text-muted hover:bg-surface hover:text-danger"
                          >
                            {isGeneral ? <Trash2 size={14} /> : <Undo2 size={14} />}
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
