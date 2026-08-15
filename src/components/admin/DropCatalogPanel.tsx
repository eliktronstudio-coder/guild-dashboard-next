"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { Plus, Trash2, Pencil, X, ImageOff } from "lucide-react";

const numberFmt = new Intl.NumberFormat("ru-RU");
const MAX_IMAGE_BYTES = 800_000;

type CatalogItem = {
  id: string;
  name: string;
  price: number;
  imageUrl: string | null;
};

type FormState = {
  name: string;
  price: string;
  imageUrl: string | null;
};

const emptyForm: FormState = { name: "", price: "0", imageUrl: null };

function readFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}

export default function DropCatalogPanel({ items }: { items: CatalogItem[] }) {
  const router = useRouter();
  const [adding, setAdding] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<FormState>(emptyForm);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  function startAdd() {
    setForm(emptyForm);
    setError(null);
    setEditingId(null);
    setAdding(true);
  }

  function startEdit(item: CatalogItem) {
    setForm({ name: item.name, price: String(item.price), imageUrl: item.imageUrl });
    setError(null);
    setAdding(false);
    setEditingId(item.id);
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
    if (file.size > MAX_IMAGE_BYTES) {
      setError("Фото слишком большое (до ~600 КБ).");
      return;
    }
    const dataUrl = await readFileAsDataUrl(file);
    setForm((f) => ({ ...f, imageUrl: dataUrl }));
    setError(null);
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setBusy(true);

    const payload = {
      name: form.name,
      price: Number(form.price),
      imageUrl: form.imageUrl,
    };

    try {
      const res = await fetch(editingId ? `/api/drop-catalog/${editingId}` : "/api/drop-catalog", {
        method: editingId ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
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
    if (!confirm("Удалить предмет из реестра?")) return;
    setBusy(true);
    await fetch(`/api/drop-catalog/${id}`, { method: "DELETE" });
    setBusy(false);
    router.refresh();
  }

  return (
    <div className="space-y-4">
      <div>
        <p className="mb-3 text-sm text-muted">
          Предметы отсюда можно будет выбирать при заполнении дропа в активностях и в казне — название и
          цена подставятся автоматически.
        </p>
        {!adding && !editingId && (
          <button
            type="button"
            onClick={startAdd}
            className="flex items-center gap-2 rounded-md bg-accent px-3 py-2 text-sm font-medium text-black hover:opacity-90"
          >
            <Plus size={16} /> Добавить предмет
          </button>
        )}

        {(adding || editingId) && (
          <form
            onSubmit={handleSubmit}
            className="grid grid-cols-1 gap-3 rounded-lg border border-border bg-surface p-4 sm:grid-cols-2 lg:grid-cols-4"
          >
            <div className="lg:col-span-2">
              <label className="mb-1 block text-xs text-muted">Название</label>
              <input
                value={form.name}
                onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                required
                maxLength={60}
                className="w-full rounded-md border border-border bg-surface-2 px-3 py-2 text-sm outline-none focus:border-accent"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs text-muted">Цена за ед. (золото)</label>
              <input
                type="number"
                value={form.price}
                onChange={(e) => setForm((f) => ({ ...f, price: e.target.value }))}
                min={0}
                required
                className="w-full rounded-md border border-border bg-surface-2 px-3 py-2 text-sm outline-none focus:border-accent"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs text-muted">Фото</label>
              <div className="flex items-center gap-2">
                {form.imageUrl ? (
                  <Image
                    src={form.imageUrl}
                    alt=""
                    width={36}
                    height={36}
                    unoptimized
                    className="h-9 w-9 rounded border border-border object-cover"
                  />
                ) : (
                  <div className="flex h-9 w-9 items-center justify-center rounded border border-border bg-surface-2 text-muted">
                    <ImageOff size={14} />
                  </div>
                )}
                <input
                  type="file"
                  accept="image/*"
                  onChange={handlePhotoChange}
                  className="w-full text-xs text-muted file:mr-2 file:rounded-md file:border file:border-border file:bg-surface-2 file:px-2 file:py-1.5 file:text-xs file:text-foreground"
                />
              </div>
            </div>

            {error && <p className="text-xs text-danger lg:col-span-4">{error}</p>}

            <div className="flex items-end gap-2 lg:col-span-4">
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
      </div>

      <div className="overflow-x-auto rounded-lg border border-border bg-surface">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border text-left text-xs uppercase tracking-wider text-muted">
              <th className="px-4 py-3 font-medium">Фото</th>
              <th className="px-4 py-3 font-medium">Название</th>
              <th className="px-4 py-3 font-medium">Цена за ед.</th>
              <th className="px-4 py-3 font-medium" />
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {items.map((item) => (
              <tr key={item.id} className="hover:bg-surface-2">
                <td className="px-4 py-3">
                  {item.imageUrl ? (
                    <Image
                      src={item.imageUrl}
                      alt=""
                      width={32}
                      height={32}
                      unoptimized
                      className="h-8 w-8 rounded border border-border object-cover"
                    />
                  ) : (
                    <div className="flex h-8 w-8 items-center justify-center rounded border border-border bg-surface-2 text-muted">
                      <ImageOff size={13} />
                    </div>
                  )}
                </td>
                <td className="px-4 py-3 font-medium">{item.name}</td>
                <td className="px-4 py-3 text-accent">{numberFmt.format(item.price)}</td>
                <td className="px-4 py-3">
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => startEdit(item)}
                      aria-label="Редактировать"
                      className="rounded p-1.5 text-muted hover:bg-surface-2 hover:text-foreground"
                    >
                      <Pencil size={15} />
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDelete(item.id)}
                      aria-label="Удалить"
                      className="rounded p-1.5 text-muted hover:bg-surface-2 hover:text-danger"
                    >
                      <Trash2 size={15} />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
            {items.length === 0 && (
              <tr>
                <td colSpan={4} className="px-4 py-6 text-center text-muted">
                  Реестр пока пуст.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
