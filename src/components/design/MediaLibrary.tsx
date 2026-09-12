"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Upload, Trash2, Loader2, X, Crop } from "lucide-react";
import CropDialog from "./CropDialog";
import clsx from "clsx";

export type MediaItem = {
  id: string;
  name: string;
  mimeType: string;
  byteSize: number;
  width: number | null;
  height: number | null;
  createdAt: string;
};

const MAX_BYTES = 4_000_000;

function readAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}

/** Собственные размеры картинки — сохраняем, чтобы показывать их в списке. */
function imageSize(dataUrl: string): Promise<{ width: number; height: number } | null> {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => resolve({ width: img.naturalWidth, height: img.naturalHeight });
    img.onerror = () => resolve(null);
    img.src = dataUrl;
  });
}

function formatSize(bytes: number) {
  if (bytes < 1024) return `${bytes} Б`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} КБ`;
  return `${(bytes / 1024 / 1024).toFixed(1)} МБ`;
}

/**
 * Медиатека редактора. Файлы хранятся на сервере и отдаются отдельным
 * маршрутом, поэтому переживают передеплой и не попадают в тело страницы.
 */
export default function MediaLibrary({
  open,
  onClose,
  onPick,
}: {
  open: boolean;
  onClose: () => void;
  /** Если задан — библиотека работает как выбор файла. */
  onPick?: (id: string) => void;
}) {
  const [items, setItems] = useState<MediaItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const [cropping, setCropping] = useState<MediaItem | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/design/media", { cache: "no-store" });
      if (!res.ok) throw new Error("Не удалось загрузить медиатеку.");
      setItems(((await res.json()) as { items: MediaItem[] }).items);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Ошибка загрузки.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (open) void load();
  }, [open, load]);

  async function upload(files: FileList | null) {
    if (!files || files.length === 0) return;
    setBusy(true);
    setError(null);
    try {
      for (const file of Array.from(files)) {
        if (file.size > MAX_BYTES) {
          setError(`«${file.name}» больше 4 МБ — файл пропущен.`);
          continue;
        }
        const dataUrl = await readAsDataUrl(file);
        const size = await imageSize(dataUrl);
        const res = await fetch("/api/design/media", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ name: file.name, dataUrl, width: size?.width, height: size?.height }),
        });
        if (!res.ok) {
          const data = await res.json().catch(() => ({}));
          setError(data.error ?? `Не удалось загрузить «${file.name}».`);
          continue;
        }
        const data = (await res.json()) as { item: MediaItem };
        setItems((prev) => [data.item, ...prev]);
      }
    } finally {
      setBusy(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  async function remove(id: string) {
    if (!window.confirm("Удалить файл из медиатеки?")) return;
    setBusy(true);
    setError(null);
    const res = await fetch(`/api/design/media/${id}`, { method: "DELETE" });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setError(data.error ?? "Не удалось удалить файл.");
    } else {
      setItems((prev) => prev.filter((i) => i.id !== id));
    }
    setBusy(false);
  }

  if (!open) return null;

  return (
    <>
    <div className="fixed inset-0 z-[80] flex items-center justify-center bg-black/60 p-4" onClick={onClose}>
      <div
        className="flex max-h-[80vh] w-full max-w-2xl flex-col overflow-hidden rounded-lg border border-border bg-surface"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between gap-3 border-b border-border px-4 py-3">
          <div>
            <h2 className="text-sm font-semibold">Медиатека</h2>
            <p className="text-[11px] text-muted">
              PNG, JPEG, WEBP, GIF, SVG — до 4 МБ. Файл, который используется опубликованной страницей, удалить нельзя.
            </p>
          </div>
          <button type="button" onClick={onClose} className="p-1 text-muted hover:text-foreground">
            <X size={16} />
          </button>
        </div>

        <div className="flex items-center gap-2 border-b border-border px-4 py-2">
          <input
            ref={fileRef}
            type="file"
            accept="image/png,image/jpeg,image/webp,image/gif,image/svg+xml"
            multiple
            onChange={(e) => void upload(e.target.files)}
            className="hidden"
          />
          <button
            type="button"
            disabled={busy}
            onClick={() => fileRef.current?.click()}
            className="flex items-center gap-1.5 rounded-md bg-accent px-3 py-1.5 text-xs font-semibold text-black hover:bg-accent-bright disabled:opacity-50"
          >
            {busy ? <Loader2 size={13} className="animate-spin" /> : <Upload size={13} />}
            Загрузить
          </button>
          {onPick && <span className="text-[11px] text-muted">Нажмите на файл, чтобы выбрать его.</span>}
        </div>

        {error && <p className="border-b border-border bg-danger/10 px-4 py-2 text-[11px] text-danger">{error}</p>}

        <div className="scroll-slim min-h-0 flex-1 overflow-y-auto p-3">
          {loading ? (
            <p className="py-8 text-center text-xs text-muted">
              <Loader2 size={14} className="mr-1.5 inline animate-spin" /> Загрузка…
            </p>
          ) : items.length === 0 ? (
            <p className="py-8 text-center text-xs text-muted">Медиатека пуста. Загрузите первый файл.</p>
          ) : (
            <ul className="grid grid-cols-2 gap-2 sm:grid-cols-3">
              {items.map((item) => (
                <li key={item.id} className="overflow-hidden rounded-lg border border-border bg-surface-2">
                  <button
                    type="button"
                    disabled={!onPick}
                    onClick={() => onPick?.(item.id)}
                    className={clsx(
                      "block w-full",
                      onPick ? "cursor-pointer hover:opacity-90" : "cursor-default"
                    )}
                  >
                    <span className="flex h-24 items-center justify-center overflow-hidden bg-surface">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={`/api/design/media/${item.id}/file`}
                        alt={item.name}
                        className="max-h-24 max-w-full object-contain"
                      />
                    </span>
                  </button>
                  <div className="flex items-center justify-between gap-1 px-2 py-1.5">
                    <span className="min-w-0 flex-1 truncate text-[10px] text-muted" title={item.name}>
                      {item.name}
                    </span>
                    {item.mimeType !== "image/svg+xml" && (
                      <button
                        type="button"
                        onClick={() => setCropping(item)}
                        disabled={busy}
                        title="Кадрировать"
                        className="flex-shrink-0 text-muted hover:text-accent disabled:opacity-40"
                      >
                        <Crop size={12} />
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => void remove(item.id)}
                      disabled={busy}
                      title="Удалить"
                      className="flex-shrink-0 text-muted hover:text-danger disabled:opacity-40"
                    >
                      <Trash2 size={12} />
                    </button>
                  </div>
                  <p className="px-2 pb-1.5 text-[9px] text-muted-2">
                    {formatSize(item.byteSize)}
                    {item.width && item.height ? ` · ${item.width}×${item.height}` : ""}
                  </p>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>

      {cropping && (
        <CropDialog
          mediaId={cropping.id}
          mediaName={cropping.name}
          onClose={() => setCropping(null)}
          onSaved={() => {
            setCropping(null);
            void load();
          }}
        />
      )}
    </>
  );
}
