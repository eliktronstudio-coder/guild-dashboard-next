"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { Plus, Trash2, ImageOff } from "lucide-react";
import clsx from "clsx";
import AddDropForm from "./AddDropForm";

const numberFmt = new Intl.NumberFormat("ru-RU");

type Drop = {
  id: string;
  item: string;
  value: number;
  quantity: number;
  status: string;
  date: string;
  activityName: string | null;
  playerName: string | null;
  imageUrl: string | null;
};

type ActivityOption = { id: string; name: string };
type PlayerOption = { id: string; name: string };
type CatalogItem = { id: string; name: string; price: number; imageUrl: string | null };

export default function DropsPanel({
  drops,
  activities,
  players,
  catalog,
  isAdmin,
}: {
  drops: Drop[];
  activities: ActivityOption[];
  players: PlayerOption[];
  catalog: CatalogItem[];
  isAdmin: boolean;
}) {
  const router = useRouter();
  const [adding, setAdding] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);

  async function handleDelete(id: string) {
    if (!confirm("Удалить запись о дропе?")) return;
    setBusyId(id);
    await fetch(`/api/drops/${id}`, { method: "DELETE" });
    setBusyId(null);
    router.refresh();
  }

  return (
    <div className="space-y-4">
      {isAdmin && (
        <div>
          {!adding && (
            <button
              type="button"
              onClick={() => setAdding(true)}
              className="flex items-center gap-2 rounded-md bg-accent px-3 py-2 text-sm font-medium text-black hover:opacity-90"
            >
              <Plus size={16} /> Добавить дроп
            </button>
          )}

          {adding && (
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
          )}
        </div>
      )}

      <div className="rounded-lg border border-border bg-surface">
        <div className="border-b border-border p-4">
          <h2 className="text-sm font-semibold">Журнал дропа</h2>
        </div>
        <ul className="divide-y divide-border">
          {drops.map((d) => (
            <li key={d.id} className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1.5 px-4 py-3 text-sm">
              <span className="flex flex-wrap items-center gap-2">
                {d.imageUrl ? (
                  <Image
                    src={d.imageUrl}
                    alt=""
                    width={24}
                    height={24}
                    unoptimized
                    className="h-6 w-6 flex-shrink-0 rounded border border-border object-cover"
                  />
                ) : (
                  <div className="flex h-6 w-6 flex-shrink-0 items-center justify-center rounded border border-border bg-surface-2 text-muted">
                    <ImageOff size={10} />
                  </div>
                )}
                <span className="font-medium">{d.item}</span>
                <span className="text-xs text-muted">
                  ×{d.quantity} · {numberFmt.format(d.value)}/ед.
                </span>
                {(d.activityName || d.playerName) && (
                  <span className="text-xs text-muted">
                    {[d.activityName, d.playerName].filter(Boolean).join(" · ")}
                  </span>
                )}
              </span>
              <span className="flex items-center gap-3">
                <span className="text-accent">{numberFmt.format(d.value * d.quantity)} золота</span>
                <span className="text-xs text-muted">{d.date}</span>
                <span
                  className={clsx(
                    "rounded-full border px-2 py-0.5 text-[11px] font-medium",
                    d.status === "Продано" ? "border-success/40 text-success" : "border-border text-muted"
                  )}
                >
                  {d.status}
                </span>
                {isAdmin && (
                  <button
                    type="button"
                    onClick={() => handleDelete(d.id)}
                    disabled={busyId === d.id}
                    aria-label="Удалить"
                    className="rounded p-1 text-muted hover:bg-surface-2 hover:text-danger disabled:opacity-60"
                  >
                    <Trash2 size={14} />
                  </button>
                )}
              </span>
            </li>
          ))}
          {drops.length === 0 && <li className="px-4 py-6 text-center text-muted">Пока нет записей о дропе.</li>}
        </ul>
      </div>
    </div>
  );
}
