"use client";

import { useCallback, useEffect, useRef } from "react";

/**
 * Предпросмотр страницы в iframe.
 *
 * Кадр открывается с того же домена, поэтому обработчики вешаются прямо на
 * документ внутри — без протокола сообщений. Это же даёт подсветку наведения
 * и выбор элемента кликом.
 *
 * В режиме «Выбор» переходы и отправка форм внутри кадра блокируются: иначе
 * клик по строке увёл бы предпросмотр на другую страницу, а случайная кнопка
 * могла бы выполнить настоящее действие над рабочими данными.
 */

const OVERLAY_STYLE_ID = "xd-design-overlay";

const OVERLAY_CSS = `
[data-design-el][data-xd-hover] { outline: 2px dashed rgba(255,158,44,.85) !important; outline-offset: -2px !important; cursor: pointer !important; }
[data-design-el][data-xd-selected] { outline: 2px solid rgba(255,158,44,1) !important; outline-offset: -2px !important; box-shadow: 0 0 0 3px rgba(255,158,44,.25) !important; }
`;

export type PreviewMode = "select" | "interact";

type Props = {
  src: string;
  mode: PreviewMode;
  selectedId: string | null;
  onSelect: (id: string) => void;
  /** Сообщает наружу, какие id реально присутствуют на странице. */
  onElementsFound?: (ids: string[]) => void;
  width: number | null;
  onReload?: (reload: () => void) => void;
};

export default function PreviewFrame({
  src,
  mode,
  selectedId,
  onSelect,
  onElementsFound,
  width,
  onReload,
}: Props) {
  const frameRef = useRef<HTMLIFrameElement>(null);
  const modeRef = useRef(mode);
  const selectRef = useRef(onSelect);
  modeRef.current = mode;
  selectRef.current = onSelect;

  const wire = useCallback(() => {
    const frame = frameRef.current;
    const doc = frame?.contentDocument;
    if (!doc) return;

    if (!doc.getElementById(OVERLAY_STYLE_ID)) {
      const style = doc.createElement("style");
      style.id = OVERLAY_STYLE_ID;
      style.textContent = OVERLAY_CSS;
      doc.head.appendChild(style);
    }

    const found = new Set<string>();
    doc.querySelectorAll("[data-design-el]").forEach((el) => {
      const id = el.getAttribute("data-design-el");
      if (id) found.add(id);
    });
    onElementsFound?.([...found]);

    const closestEditable = (target: EventTarget | null) =>
      target instanceof Element ? (target.closest("[data-design-el]") as HTMLElement | null) : null;

    const onOver = (e: Event) => {
      if (modeRef.current !== "select") return;
      doc.querySelectorAll("[data-xd-hover]").forEach((el) => el.removeAttribute("data-xd-hover"));
      closestEditable(e.target)?.setAttribute("data-xd-hover", "1");
    };

    const onClick = (e: MouseEvent) => {
      if (modeRef.current !== "select") return;
      const el = closestEditable(e.target);
      // Блокируем переход/отправку даже если клик пришёлся мимо элемента:
      // в режиме выбора предпросмотр не должен ничего выполнять.
      e.preventDefault();
      e.stopPropagation();
      const id = el?.getAttribute("data-design-el");
      if (id) selectRef.current(id);
    };

    const onSubmit = (e: Event) => {
      if (modeRef.current !== "select") return;
      e.preventDefault();
      e.stopPropagation();
    };

    doc.addEventListener("mouseover", onOver, true);
    doc.addEventListener("click", onClick, true);
    doc.addEventListener("submit", onSubmit, true);

    return () => {
      doc.removeEventListener("mouseover", onOver, true);
      doc.removeEventListener("click", onClick, true);
      doc.removeEventListener("submit", onSubmit, true);
    };
  }, [onElementsFound]);

  useEffect(() => {
    const frame = frameRef.current;
    if (!frame) return;
    let cleanup: (() => void) | undefined;
    const handle = () => {
      cleanup?.();
      cleanup = wire();
    };
    frame.addEventListener("load", handle);
    // Кадр мог успеть загрузиться до подписки.
    if (frame.contentDocument?.readyState === "complete") handle();
    return () => {
      frame.removeEventListener("load", handle);
      cleanup?.();
    };
  }, [wire, src]);

  // Подсветка выбранного элемента.
  useEffect(() => {
    const doc = frameRef.current?.contentDocument;
    if (!doc) return;
    doc.querySelectorAll("[data-xd-selected]").forEach((el) => el.removeAttribute("data-xd-selected"));
    if (!selectedId) return;
    doc.querySelectorAll(`[data-design-el="${CSS.escape(selectedId)}"]`).forEach((el) =>
      el.setAttribute("data-xd-selected", "1")
    );
  }, [selectedId, src]);

  useEffect(() => {
    onReload?.(() => {
      const frame = frameRef.current;
      if (frame) frame.src = frame.src;
    });
  }, [onReload]);

  return (
    <div className="flex h-full w-full items-start justify-center overflow-auto bg-surface-2 p-4">
      <iframe
        ref={frameRef}
        src={src}
        title="Предпросмотр страницы"
        className="h-full min-h-[600px] rounded-lg border border-border bg-background shadow-lg"
        style={{ width: width ? `${width}px` : "100%", maxWidth: "100%" }}
      />
    </div>
  );
}
