"use client";

import { useEffect, type ReactNode } from "react";
import { X } from "lucide-react";

export default function Drawer({
  open,
  onClose,
  title,
  children,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
}) {
  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    document.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[70]">
      <button
        type="button"
        aria-label="Закрыть"
        onClick={onClose}
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="drawer-title"
        className="absolute inset-y-0 right-0 flex w-full flex-col border-l border-border-strong bg-surface shadow-2xl sm:w-[420px] sm:rounded-l-lg"
      >
        <div className="flex items-center justify-between gap-3 border-b border-border px-5 py-4">
          <h2 id="drawer-title" className="text-base font-semibold">
            {title}
          </h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Закрыть"
            className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-md text-muted hover:bg-surface-2 hover:text-foreground"
          >
            <X size={18} />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto px-5 py-4">{children}</div>
      </div>
    </div>
  );
}
