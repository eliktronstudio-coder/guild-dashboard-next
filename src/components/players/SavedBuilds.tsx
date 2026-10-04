"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ExternalLink, Trash2 } from "lucide-react";

const dateFmt = new Intl.DateTimeFormat("ru-RU", { day: "numeric", month: "short" });

export type SavedBuild = { id: string; label: string; url: string; createdAt: string };

/**
 * Сборки из внешнего калькулятора (aje-calc.h1n.ru), привязанные к игроку.
 *
 * Калькулятор встроен во фрейм с другого домена — его "Сохранить сборку"
 * нельзя перехватить на нашей стороне, поэтому игрок сам вставляет готовую
 * ссылку сюда после сохранения там.
 */
export default function SavedBuilds({
  playerId,
  builds,
  canEdit,
}: {
  playerId: string;
  builds: SavedBuild[];
  canEdit: boolean;
}) {
  const router = useRouter();
  const [adding, setAdding] = useState(false);
  const [label, setLabel] = useState("");
  const [url, setUrl] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function save() {
    setError(null);
    setBusy(true);
    try {
      const res = await fetch(`/api/players/${playerId}/builds`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ label, url }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error ?? "Не удалось сохранить.");
        return;
      }
      setLabel("");
      setUrl("");
      setAdding(false);
      router.refresh();
    } catch {
      setError("Сеть недоступна.");
    } finally {
      setBusy(false);
    }
  }

  async function remove(buildId: string) {
    await fetch(`/api/players/${playerId}/builds/${buildId}`, { method: "DELETE" });
    router.refresh();
  }

  return (
    <div className="rounded-lg border border-border bg-surface p-4">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="text-sm font-semibold">Сборки куклы</h2>
        {canEdit && !adding && (
          <button type="button" onClick={() => setAdding(true)} className="text-xs text-accent hover:underline">
            Добавить
          </button>
        )}
      </div>

      {canEdit && adding && (
        <div className="mt-3 space-y-2">
          <p className="text-xs text-muted">
            Сохраните сборку на калькуляторе и вставьте полученную ссылку сюда.
          </p>
          <div className="flex flex-wrap gap-2">
            <input
              type="text"
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              placeholder="Подпись, например «ПвП»"
              maxLength={40}
              className="min-w-0 flex-1 rounded-md border border-border bg-surface-2 px-2.5 py-1.5 text-xs"
            />
            <input
              type="url"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="https://aje-calc.h1n.ru/build/..."
              className="min-w-0 flex-[2] rounded-md border border-border bg-surface-2 px-2.5 py-1.5 text-xs"
            />
          </div>
          {error && <p className="text-xs text-red-500">{error}</p>}
          <div className="flex gap-2">
            <button
              type="button"
              disabled={busy}
              onClick={save}
              className="rounded-md bg-accent px-3 py-1 text-xs font-medium text-black disabled:opacity-50"
            >
              Сохранить
            </button>
            <button
              type="button"
              onClick={() => {
                setAdding(false);
                setError(null);
              }}
              className="rounded-md border border-border px-3 py-1 text-xs hover:bg-surface-2"
            >
              Отмена
            </button>
          </div>
        </div>
      )}

      {builds.length === 0 ? (
        <p className="mt-3 text-xs text-muted">Сборок пока нет.</p>
      ) : (
        <ul className="mt-3 space-y-1.5">
          {builds.map((b) => (
            <li
              key={b.id}
              className="flex items-center justify-between gap-2 rounded-md border border-border bg-surface-2 px-3 py-2 text-xs"
            >
              <a
                href={b.url}
                target="_blank"
                rel="noopener noreferrer"
                className="flex min-w-0 items-center gap-1.5 text-accent hover:underline"
              >
                <span className="truncate font-medium text-foreground">{b.label}</span>
                <ExternalLink size={11} className="flex-shrink-0" />
              </a>
              <div className="flex flex-shrink-0 items-center gap-2 text-muted-2">
                <span>{dateFmt.format(new Date(b.createdAt))}</span>
                {canEdit && (
                  <button type="button" onClick={() => remove(b.id)} aria-label="Удалить" className="hover:text-danger">
                    <Trash2 size={13} />
                  </button>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
