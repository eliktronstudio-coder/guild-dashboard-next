"use client";

import { useEffect, useRef, useState } from "react";
import { Crop, Loader2, X } from "lucide-react";
import clsx from "clsx";

/**
 * Кадрирование изображения.
 *
 * Результат сохраняется НОВЫМ файлом: исходник может стоять на уже
 * опубликованных страницах, и перезапись сломала бы их вид.
 *
 * Обрезка делается в canvas на стороне браузера — сервер получает готовый
 * PNG и проверяет его так же, как любую загрузку.
 */

type Rect = { x: number; y: number; w: number; h: number };

const ASPECTS: { label: string; value: number | null }[] = [
  { label: "Свободно", value: null },
  { label: "1:1", value: 1 },
  { label: "16:9", value: 16 / 9 },
  { label: "4:3", value: 4 / 3 },
  { label: "3:1", value: 3 },
];

export default function CropDialog({
  mediaId,
  mediaName,
  onClose,
  onSaved,
}: {
  mediaId: string;
  mediaName: string;
  onClose: () => void;
  onSaved: (newId: string) => void;
}) {
  const imgRef = useRef<HTMLImageElement>(null);
  const boxRef = useRef<HTMLDivElement>(null);
  const [rect, setRect] = useState<Rect | null>(null);
  const [aspect, setAspect] = useState<number | null>(null);
  const [dragging, setDragging] = useState(false);
  const [start, setStart] = useState<{ x: number; y: number } | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [ready, setReady] = useState(false);

  // Начальная рамка — вся картинка, чтобы было что сохранять сразу.
  useEffect(() => {
    if (!ready) return;
    const box = boxRef.current;
    if (!box) return;
    setRect({ x: 0, y: 0, w: box.clientWidth, h: box.clientHeight });
  }, [ready]);

  function clampRect(r: Rect): Rect {
    const box = boxRef.current;
    if (!box) return r;
    const maxW = box.clientWidth;
    const maxH = box.clientHeight;
    let { x, y, w, h } = r;
    w = Math.max(10, Math.min(w, maxW));
    h = Math.max(10, Math.min(h, maxH));
    if (aspect) h = w / aspect;
    x = Math.max(0, Math.min(x, maxW - w));
    y = Math.max(0, Math.min(y, maxH - h));
    if (y + h > maxH) {
      h = maxH - y;
      if (aspect) w = h * aspect;
    }
    return { x, y, w, h };
  }

  function pointerPos(e: React.PointerEvent) {
    const box = boxRef.current!.getBoundingClientRect();
    return { x: e.clientX - box.left, y: e.clientY - box.top };
  }

  async function save() {
    const img = imgRef.current;
    const box = boxRef.current;
    if (!img || !box || !rect) return;

    setBusy(true);
    setError(null);
    try {
      // Пересчёт из экранных координат в пиксели исходника.
      const scaleX = img.naturalWidth / box.clientWidth;
      const scaleY = img.naturalHeight / box.clientHeight;
      const sx = Math.round(rect.x * scaleX);
      const sy = Math.round(rect.y * scaleY);
      const sw = Math.max(1, Math.round(rect.w * scaleX));
      const sh = Math.max(1, Math.round(rect.h * scaleY));

      const canvas = document.createElement("canvas");
      canvas.width = sw;
      canvas.height = sh;
      const ctx = canvas.getContext("2d");
      if (!ctx) throw new Error("Браузер не дал нарисовать изображение.");
      ctx.drawImage(img, sx, sy, sw, sh, 0, 0, sw, sh);

      const dataUrl = canvas.toDataURL("image/png");
      const base = mediaName.replace(/\.[^.]+$/, "");
      const res = await fetch("/api/design/media", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: `${base}-обрезано.png`, dataUrl, width: sw, height: sh }),
      });
      if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error ?? "Не удалось сохранить файл.");
      const data = (await res.json()) as { item: { id: string } };
      onSaved(data.item.id);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Ошибка кадрирования.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="fixed inset-0 z-[90] flex items-center justify-center bg-black/70 p-4" onClick={onClose}>
      <div
        className="flex max-h-[85vh] w-full max-w-xl flex-col overflow-hidden rounded-lg border border-border bg-surface"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between gap-3 border-b border-border px-4 py-3">
          <div>
            <h2 className="text-sm font-semibold">Кадрирование — {mediaName}</h2>
            <p className="text-[11px] text-muted">
              Выделите область мышью. Результат сохранится новым файлом, исходник останется в медиатеке.
            </p>
          </div>
          <button type="button" onClick={onClose} className="p-1 text-muted hover:text-foreground">
            <X size={16} />
          </button>
        </div>

        <div className="flex items-center gap-1.5 border-b border-border px-4 py-2">
          <span className="text-[11px] text-muted">Пропорции:</span>
          {ASPECTS.map((a) => (
            <button
              key={a.label}
              type="button"
              onClick={() => {
                setAspect(a.value);
                if (rect) setRect(clampRect({ ...rect }));
              }}
              className={clsx(
                "rounded border px-1.5 py-1 text-[10px]",
                aspect === a.value ? "border-accent text-accent" : "border-border text-muted hover:text-foreground"
              )}
            >
              {a.label}
            </button>
          ))}
        </div>

        {error && <p className="border-b border-border bg-danger/10 px-4 py-2 text-[11px] text-danger">{error}</p>}

        <div className="scroll-slim min-h-0 flex-1 overflow-auto bg-surface-2 p-4">
          <div
            ref={boxRef}
            className="relative mx-auto w-fit select-none"
            onPointerDown={(e) => {
              e.currentTarget.setPointerCapture(e.pointerId);
              const p = pointerPos(e);
              setStart(p);
              setDragging(true);
              setRect(clampRect({ x: p.x, y: p.y, w: 10, h: 10 }));
            }}
            onPointerMove={(e) => {
              if (!dragging || !start) return;
              const p = pointerPos(e);
              const x = Math.min(start.x, p.x);
              const y = Math.min(start.y, p.y);
              const w = Math.abs(p.x - start.x);
              const h = Math.abs(p.y - start.y);
              setRect(clampRect({ x, y, w, h }));
            }}
            onPointerUp={() => {
              setDragging(false);
              setStart(null);
            }}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              ref={imgRef}
              src={`/api/design/media/${mediaId}/file`}
              alt={mediaName}
              onLoad={() => setReady(true)}
              className="max-h-[50vh] max-w-full"
              draggable={false}
            />
            {rect && (
              <>
                <div className="pointer-events-none absolute inset-0 bg-black/50" />
                <div
                  className="pointer-events-none absolute border-2 border-accent"
                  style={{
                    left: rect.x,
                    top: rect.y,
                    width: rect.w,
                    height: rect.h,
                    boxShadow: "0 0 0 9999px rgba(0,0,0,0)",
                    // Вырезаем затемнение под рамкой, чтобы видеть кадр.
                    backgroundImage: `url(/api/design/media/${mediaId}/file)`,
                    backgroundSize: `${imgRef.current?.clientWidth ?? 0}px ${imgRef.current?.clientHeight ?? 0}px`,
                    backgroundPosition: `-${rect.x}px -${rect.y}px`,
                  }}
                />
              </>
            )}
          </div>
        </div>

        <div className="flex items-center justify-between gap-2 border-t border-border px-4 py-2">
          <span className="text-[11px] text-muted">
            {rect && imgRef.current
              ? `Кадр: ${Math.round((rect.w * imgRef.current.naturalWidth) / (boxRef.current?.clientWidth || 1))}×${Math.round(
                  (rect.h * imgRef.current.naturalHeight) / (boxRef.current?.clientHeight || 1)
                )} px`
              : "Выделите область"}
          </span>
          <div className="flex items-center gap-2">
            <button type="button" onClick={onClose} className="rounded-md border border-border px-3 py-1.5 text-xs">
              Отмена
            </button>
            <button
              type="button"
              onClick={() => void save()}
              disabled={busy || !rect}
              className="flex items-center gap-1.5 rounded-md bg-accent px-3 py-1.5 text-xs font-semibold text-black hover:bg-accent-bright disabled:opacity-50"
            >
              {busy ? <Loader2 size={13} className="animate-spin" /> : <Crop size={13} />}
              Обрезать и сохранить
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
