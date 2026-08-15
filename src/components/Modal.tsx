"use client";

import { useEffect, type ReactNode } from "react";
import { X } from "lucide-react";

export default function Modal({
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
    return () => document.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center p-4">
      <button
        type="button"
        aria-label="Закрыть"
        onClick={onClose}
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="modal-title"
        className="relative w-full max-w-sm rounded-lg border border-border-strong bg-surface p-5 shadow-2xl"
      >
        <div className="mb-3 flex items-center justify-between gap-3">
          <h2 id="modal-title" className="text-sm font-semibold">
            {title}
          </h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Закрыть"
            className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-md text-muted hover:bg-surface-2 hover:text-foreground"
          >
            <X size={16} />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}
