"use client";

import { useEffect, useState, type ChangeEvent } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { Plus, Trash2, X } from "lucide-react";

const MAX_IMAGE_BYTES = 800_000;
const MAX_ITEMS = 6;

type Shot = { id: string; imageUrl: string };

function readFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}

export default function ScreenshotBanner({
  activityId,
  kind,
  title,
  screenshots,
  isAdmin,
}: {
  activityId: string;
  kind: "roster" | "drop";
  title: string;
  screenshots: Shot[];
  isAdmin: boolean;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lightbox, setLightbox] = useState<string | null>(null);

  useEffect(() => {
    if (!lightbox) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setLightbox(null);
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [lightbox]);

  async function handleFiles(e: ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? []);
    e.target.value = "";
    if (files.length === 0) return;
    if (screenshots.length + files.length > MAX_ITEMS) {
      setError(`Максимум ${MAX_ITEMS} скринов.`);
      return;
    }
    setError(null);
    setBusy(true);
    try {
      const items: { kind: string; imageUrl: string }[] = [];
      for (const file of files) {
        if (!file.type.startsWith("image/")) {
          setError("Файл должен быть изображением.");
          continue;
        }
        if (file.size > MAX_IMAGE_BYTES) {
          setError("Фото слишком большое (до ~600 КБ).");
          continue;
        }
        items.push({ kind, imageUrl: await readFileAsDataUrl(file) });
      }
      if (items.length === 0) return;
      const res = await fetch(`/api/activities/${activityId}/screenshots`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ items }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Что-то пошло не так.");
        return;
      }
      router.refresh();
    } catch {
      setError("Не удалось связаться с сервером.");
    } finally {
      setBusy(false);
    }
  }

  async function handleDelete(id: string) {
    if (!confirm("Удалить скрин?")) return;
    setBusy(true);
    await fetch(`/api/activities/${activityId}/screenshots/${id}`, { method: "DELETE" });
    setBusy(false);
    router.refresh();
  }

  return (
    <div className="rounded-lg border border-border bg-surface p-4">
      <div className="mb-3 flex items-center justify-between">
        <h3 className="text-sm font-semibold">{title}</h3>
        {isAdmin && (
          <label className="flex cursor-pointer items-center gap-1.5 rounded-md border border-border px-2 py-1 text-xs text-foreground/80 hover:bg-surface-2 hover:text-foreground">
            <Plus size={13} /> Добавить
            <input
              type="file"
              accept="image/*"
              multiple
              onChange={handleFiles}
              disabled={busy}
              className="hidden"
            />
          </label>
        )}
      </div>

      {error && <p className="mb-2 text-xs text-danger">{error}</p>}

      {screenshots.length === 0 ? (
        <p className="text-xs text-muted">Скринов пока нет.</p>
      ) : (
        <div className="space-y-2">
          {screenshots.map((s) => (
            <div key={s.id} className="group relative">
              <button
                type="button"
                onClick={() => setLightbox(s.imageUrl)}
                className="flex h-28 w-full items-center justify-center overflow-hidden rounded-md border border-border bg-surface-2"
              >
                <Image
                  src={s.imageUrl}
                  alt={title}
                  width={400}
                  height={160}
                  unoptimized
                  className="h-full w-full object-contain transition-opacity hover:opacity-90"
                />
              </button>
              {isAdmin && (
                <button
                  type="button"
                  onClick={() => handleDelete(s.id)}
                  aria-label="Удалить скрин"
                  className="absolute right-1.5 top-1.5 rounded bg-black/60 p-1 text-white opacity-0 transition-opacity group-hover:opacity-100"
                >
                  <Trash2 size={13} />
                </button>
              )}
            </div>
          ))}
        </div>
      )}

      {lightbox && (
        <div className="fixed inset-0 z-[80] flex items-center justify-center p-4">
          <button
            type="button"
            aria-label="Закрыть"
            onClick={() => setLightbox(null)}
            className="absolute inset-0 bg-black/80 backdrop-blur-sm"
          />
          <div className="relative max-h-[90vh] max-w-4xl">
            <button
              type="button"
              onClick={() => setLightbox(null)}
              aria-label="Закрыть"
              className="absolute -top-10 right-0 rounded-md p-1.5 text-white hover:bg-white/10"
            >
              <X size={20} />
            </button>
            <Image
              src={lightbox}
              alt={title}
              width={1200}
              height={800}
              unoptimized
              className="max-h-[90vh] w-auto rounded-lg object-contain"
            />
          </div>
        </div>
      )}
    </div>
  );
}
