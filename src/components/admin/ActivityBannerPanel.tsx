"use client";

import { useState, useMemo, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { Plus, Trash2, Pencil, X, ImageOff, Search } from "lucide-react";

/** Ширина, до которой ужимается загруженное фото. Баннер показывается миниатюрой,
 *  а исходные скрины из игры весят по 2 МБ — в базу такое класть незачем. */
const TARGET_WIDTH = 640;
const MAX_IMAGE_BYTES = 800_000;

type Banner = { id: string; name: string; imageUrl: string };
type FormState = { name: string; imageUrl: string | null };

const emptyForm: FormState = { name: "", imageUrl: null };

function readFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}

/** Ужимает картинку до TARGET_WIDTH и переводит в webp. */
function downscale(dataUrl: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new window.Image();
    img.onload = () => {
      const scale = Math.min(1, TARGET_WIDTH / img.width);
      const canvas = document.createElement("canvas");
      canvas.width = Math.round(img.width * scale);
      canvas.height = Math.round(img.height * scale);
      const ctx = canvas.getContext("2d");
      if (!ctx) {
        reject(new Error("Не удалось обработать изображение."));
        return;
      }
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      resolve(canvas.toDataURL("image/webp", 0.82));
    };
    img.onerror = () => reject(new Error("Не удалось прочитать изображение."));
    img.src = dataUrl;
  });
}

export default function ActivityBannerPanel({ banners }: { banners: Banner[] }) {
  const router = useRouter();
  const [adding, setAdding] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<FormState>(emptyForm);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [search, setSearch] = useState("");

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return q ? banners.filter((b) => b.name.toLowerCase().includes(q)) : banners;
  }, [banners, search]);

  function startAdd() {
    setForm(emptyForm);
    setError(null);
    setEditingId(null);
    setAdding(true);
  }

  function startEdit(banner: Banner) {
    setForm({ name: banner.name, imageUrl: banner.imageUrl });
    setError(null);
    setAdding(false);
    setEditingId(banner.id);
  }

  function cancel() {
    setAdding(false);
    setEditingId(null);
    setError(null);
  }

  async function handlePhotoChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      setError("Файл должен быть изображением.");
      return;
    }
    try {
      const compressed = await downscale(await readFileAsDataUrl(file));
      if (compressed.length > MAX_IMAGE_BYTES) {
        setError("Фото слишком большое даже после сжатия — возьмите картинку поменьше.");
        return;
      }
      setForm((f) => ({ ...f, imageUrl: compressed }));
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Не удалось обработать фото.");
    }
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    if (!form.imageUrl) {
      setError("Загрузите фото.");
      return;
    }
    setBusy(true);
    try {
      const res = await fetch(editingId ? `/api/activity-banners/${editingId}` : "/api/activity-banners", {
        method: editingId ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: form.name, imageUrl: form.imageUrl }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Что-то пошло не так.");
        setBusy(false);
        return;
      }
      cancel();
      router.refresh();
    } catch {
      setError("Не удалось связаться с сервером.");
    } finally {
      setBusy(false);
    }
  }

  async function handleDelete(id: string) {
    if (!confirm("Удалить баннер?")) return;
    setBusy(true);
    await fetch(`/api/activity-banners/${id}`, { method: "DELETE" });
    setBusy(false);
    router.refresh();
  }

  const formOpen = adding || editingId !== null;

  return (
    <div className="space-y-4">
      <div className="rounded-lg border border-border bg-surface">
        <div className="flex items-center justify-between gap-3 border-b border-border p-4">
          <h2 className="text-sm font-semibold">Баннеры активностей</h2>
          <div className="flex items-center gap-3">
            <span className="text-xs text-muted">{banners.length} шт.</span>
            {!formOpen && (
              <button
                type="button"
                onClick={startAdd}
                className="flex items-center gap-1.5 rounded-md border border-border px-2 py-1 text-xs text-foreground/80 hover:bg-surface-2 hover:text-foreground"
              >
                <Plus size={13} /> Добавить
              </button>
            )}
          </div>
        </div>

        {formOpen && (
          <form onSubmit={handleSubmit} className="grid grid-cols-1 gap-3 border-b border-border p-4 sm:grid-cols-3">
            <div className="sm:col-span-2">
              <label className="mb-1 block text-xs text-muted">Название активности</label>
              <input
                value={form.name}
                onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                required
                maxLength={60}
                placeholder="Например: Кракен"
                className="w-full rounded-md border border-border bg-surface-2 px-3 py-2 text-sm outline-none focus:border-accent"
              />
              <p className="mt-1 text-xs text-muted-2">
                Совпадение с активностью ищется без учёта регистра, а также по началу названия и с опечаткой
                в пару букв — «АГЛ Т1» найдёт баннер «АГЛ».
              </p>
            </div>
            <div>
              <label className="mb-1 block text-xs text-muted">Фото</label>
              <div className="flex items-center gap-2">
                {form.imageUrl ? (
                  <Image
                    src={form.imageUrl}
                    alt=""
                    width={64}
                    height={38}
                    unoptimized
                    className="h-[38px] w-16 flex-shrink-0 rounded object-cover"
                  />
                ) : (
                  <span className="flex h-[38px] w-16 flex-shrink-0 items-center justify-center rounded border border-border text-muted-2">
                    <ImageOff size={16} />
                  </span>
                )}
                <input
                  type="file"
                  accept="image/*"
                  onChange={handlePhotoChange}
                  className="w-full text-xs text-muted file:mr-2 file:rounded-md file:border file:border-border file:bg-surface-2 file:px-2 file:py-1 file:text-xs file:text-foreground"
                />
              </div>
            </div>

            {error && <p className="text-xs text-danger sm:col-span-3">{error}</p>}

            <div className="flex items-center gap-2 sm:col-span-3">
              <button
                type="submit"
                disabled={busy}
                className="rounded-md bg-accent px-3 py-2 text-sm font-medium text-black hover:opacity-90 disabled:opacity-60"
              >
                {editingId ? "Сохранить" : "Добавить"}
              </button>
              <button
                type="button"
                onClick={cancel}
                className="flex items-center gap-1 rounded-md border border-border px-3 py-2 text-sm text-muted hover:text-foreground"
              >
                <X size={14} /> Отмена
              </button>
            </div>
          </form>
        )}

        {banners.length === 0 ? (
          <p className="px-4 py-6 text-center text-sm text-muted">Пока нет баннеров.</p>
        ) : (
          <>
            <div className="border-b border-border p-3">
              <div className="relative">
                <Search size={14} className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-muted" />
                <input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Поиск по названию…"
                  className="w-full rounded-md border border-border bg-surface-2 py-1.5 pl-8 pr-3 text-sm outline-none focus:border-accent"
                />
              </div>
            </div>
            <ul className="divide-y divide-border">
              {filtered.map((banner) => (
                <li key={banner.id} className="flex items-center gap-3 px-4 py-2.5">
                  <Image
                    src={banner.imageUrl}
                    alt=""
                    width={64}
                    height={38}
                    unoptimized
                    className="h-[38px] w-16 flex-shrink-0 rounded object-cover"
                  />
                  <span className="min-w-0 flex-1 truncate text-sm">{banner.name}</span>
                  <button
                    type="button"
                    onClick={() => startEdit(banner)}
                    disabled={busy}
                    aria-label="Редактировать"
                    className="rounded p-1.5 text-muted hover:bg-surface-2 hover:text-foreground"
                  >
                    <Pencil size={14} />
                  </button>
                  <button
                    type="button"
                    onClick={() => handleDelete(banner.id)}
                    disabled={busy}
                    aria-label="Удалить"
                    className="rounded p-1.5 text-muted hover:bg-surface-2 hover:text-danger"
                  >
                    <Trash2 size={14} />
                  </button>
                </li>
              ))}
            </ul>
          </>
        )}
      </div>
    </div>
  );
}
