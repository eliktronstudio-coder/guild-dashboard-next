"use client";

import { useState, useMemo, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { Plus, Trash2, Pencil, X, ImageOff, Search } from "lucide-react";

const MAX_IMAGE_BYTES = 800_000;
/**
 * Сначала пробуем сохранить исходное разрешение, и только если результат не
 * влезает в лимит хранения — снижаем качество, а затем разрешение. Так фото
 * остаётся максимально близким к оригиналу.
 */
const QUALITY_STEPS = [0.94, 0.88, 0.82, 0.75, 0.68];
const FALLBACK_WIDTHS = [2048, 1600, 1280, 1024, 800];

type Banner = {
  id: string;
  name: string;
  imageUrl: string;
  height: number | null;
  widthPct: number | null;
  imgWidth: number | null;
  imgHeight: number | null;
};
type FormState = {
  name: string;
  imageUrl: string | null;
  /** Пусто — баннер показывает картинку целиком по её пропорциям. */
  height: string;
  widthPct: string;
  imgWidth: number | null;
  imgHeight: number | null;
};

const DEFAULT_WIDTH_PCT = 100;

/** По умолчанию высота не задана — картинка показывается целиком. */
const emptyForm: FormState = {
  name: "",
  imageUrl: null,
  height: "",
  widthPct: String(DEFAULT_WIDTH_PCT),
  imgWidth: null,
  imgHeight: null,
};

function readFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}

/**
 * GIF-89a: несколько блоков-дескрипторов изображения (0x2C) — значит несколько
 * кадров, то есть анимация. Статичный GIF (один кадр) можно спокойно сжимать
 * как обычную картинку.
 */
function isAnimatedGif(buffer: ArrayBuffer): boolean {
  const bytes = new Uint8Array(buffer);
  let frames = 0;
  for (let i = 0; i < bytes.length - 1 && frames < 2; i++) {
    if (bytes[i] === 0x2c) frames++;
  }
  return frames >= 2;
}

/** WEBP хранит анимацию как отдельный чанк ANIM в контейнере RIFF. */
function isAnimatedWebp(buffer: ArrayBuffer): boolean {
  const bytes = new Uint8Array(buffer);
  const text = String.fromCharCode(...bytes.slice(0, 64));
  return text.includes("ANIM");
}

async function isAnimated(file: File): Promise<boolean> {
  if (file.type !== "image/gif" && file.type !== "image/webp") return false;
  const buffer = await file.arrayBuffer();
  return file.type === "image/gif" ? isAnimatedGif(buffer) : isAnimatedWebp(buffer);
}

function loadImage(dataUrl: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new window.Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("Не удалось прочитать изображение."));
    img.src = dataUrl;
  });
}

function encode(img: HTMLImageElement, width: number, quality: number) {
  const scale = Math.min(1, width / img.width);
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(img.width * scale);
  canvas.height = Math.round(img.height * scale);
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Не удалось обработать изображение.");
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
  return { dataUrl: canvas.toDataURL("image/webp", quality), width: canvas.width, height: canvas.height };
}

/** Берёт самый качественный вариант, который помещается в лимит хранения. */
async function compress(dataUrl: string): Promise<{ dataUrl: string; width: number; height: number; original: boolean }> {
  const img = await loadImage(dataUrl);
  const widths = [img.width, ...FALLBACK_WIDTHS.filter((w) => w < img.width)];
  let last = { dataUrl: "", width: img.width, height: img.height };
  for (const width of widths) {
    for (const quality of QUALITY_STEPS) {
      last = encode(img, width, quality);
      if (last.dataUrl.length <= MAX_IMAGE_BYTES) {
        return { ...last, original: last.width === img.width };
      }
    }
  }
  return { ...last, original: false };
}

export default function ActivityBannerPanel({ banners }: { banners: Banner[] }) {
  const router = useRouter();
  const [adding, setAdding] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<FormState>(emptyForm);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
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
    setForm({
      name: banner.name,
      imageUrl: banner.imageUrl,
      height: banner.height === null ? "" : String(banner.height),
      widthPct: String(banner.widthPct ?? DEFAULT_WIDTH_PCT),
      imgWidth: banner.imgWidth,
      imgHeight: banner.imgHeight,
    });
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
      // Пересжатие через canvas всегда схлопывает анимацию в один кадр,
      // поэтому анимированные GIF/WEBP сохраняются как есть, без пересборки.
      if (await isAnimated(file)) {
        const dataUrl = await readFileAsDataUrl(file);
        if (dataUrl.length > MAX_IMAGE_BYTES) {
          setError(
            `Анимация слишком большая (${Math.round(dataUrl.length / 1024)} КБ, лимит ${Math.round(MAX_IMAGE_BYTES / 1024)} КБ) — сожмите файл (меньше кадров/разрешение) и загрузите снова.`
          );
          return;
        }
        const img = await loadImage(dataUrl);
        setForm((f) => ({ ...f, imageUrl: dataUrl, imgWidth: img.width, imgHeight: img.height }));
        setInfo(`${img.width}×${img.height} (анимация, без сжатия), ${Math.round(dataUrl.length / 1024)} КБ`);
        setError(null);
        return;
      }

      const result = await compress(await readFileAsDataUrl(file));
      if (result.dataUrl.length > MAX_IMAGE_BYTES) {
        setError("Фото слишком большое даже после сжатия — возьмите картинку поменьше.");
        return;
      }
      setForm((f) => ({ ...f, imageUrl: result.dataUrl, imgWidth: result.width, imgHeight: result.height }));
      setInfo(
        `${result.width}×${result.height}${result.original ? " (исходное разрешение)" : " (уменьшено, чтобы влезло в лимит)"}, ` +
          `${Math.round(result.dataUrl.length / 1024)} КБ`
      );
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
        body: JSON.stringify({
          name: form.name,
          imageUrl: form.imageUrl,
          height: form.height.trim() === "" ? null : Number(form.height),
          widthPct: Number(form.widthPct),
          imgWidth: form.imgWidth,
          imgHeight: form.imgHeight,
        }),
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

            <div className="sm:col-span-3">
              <label className="mb-1 block text-xs text-muted">Размер баннера на странице активности</label>
              <div className="flex flex-wrap items-center gap-3">
                <label className="flex items-center gap-2 text-xs text-muted">
                  Высота
                  <input
                    type="number"
                    min={60}
                    max={600}
                    placeholder="авто"
                    value={form.height}
                    onChange={(e) => setForm((f) => ({ ...f, height: e.target.value }))}
                    className="w-20 rounded-md border border-border bg-surface-2 px-2 py-1.5 text-sm outline-none focus:border-accent"
                  />
                  px — пусто: картинка целиком
                </label>
                <label className="flex items-center gap-2 text-xs text-muted">
                  Ширина
                  <input
                    type="number"
                    min={10}
                    max={100}
                    value={form.widthPct}
                    onChange={(e) => setForm((f) => ({ ...f, widthPct: e.target.value }))}
                    className="w-20 rounded-md border border-border bg-surface-2 px-2 py-1.5 text-sm outline-none focus:border-accent"
                  />
                  % от карточки
                </label>
              </div>
              {form.imageUrl && (
                <div className="mt-2 rounded-md border border-border bg-surface-2 p-2">
                  <p className="mb-1.5 text-xs text-muted-2">Предпросмотр</p>
                  <div
                    className="relative overflow-hidden rounded"
                    style={{
                      ...(form.height.trim() === ""
                        ? { aspectRatio: form.imgWidth && form.imgHeight ? `${form.imgWidth} / ${form.imgHeight}` : "16 / 9" }
                        : { height: `${Math.min(600, Math.max(60, Number(form.height)))}px` }),
                      width: `${Math.min(100, Math.max(10, Number(form.widthPct) || DEFAULT_WIDTH_PCT))}%`,
                    }}
                  >
                    <Image src={form.imageUrl} alt="" fill sizes="100vw" className="object-cover" />
                  </div>
                </div>
              )}
            </div>

            {info && <p className="text-xs text-muted-2 sm:col-span-3">Загружено: {info}</p>}
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
