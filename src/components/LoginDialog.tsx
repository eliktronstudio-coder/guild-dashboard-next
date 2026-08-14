"use client";

import { useState, type FormEvent } from "react";
import { X } from "lucide-react";

type LoginDialogProps = {
  open: boolean;
  onClose: () => void;
};

export default function LoginDialog({ open, onClose }: LoginDialogProps) {
  const [notice, setNotice] = useState<string | null>(null);

  if (!open) return null;

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setNotice("Авторизация пока не подключена — это демо-интерфейс.");
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <button
        aria-label="Закрыть"
        onClick={onClose}
        className="fixed inset-0 bg-black/70"
      />
      <div className="relative z-10 w-full max-w-sm rounded-lg border border-border bg-surface p-6 shadow-xl">
        <div className="mb-5 flex items-center justify-between">
          <h2 className="text-base font-semibold">Вход</h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Закрыть"
            className="rounded p-1 text-muted hover:bg-surface-2 hover:text-foreground"
          >
            <X size={18} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label htmlFor="login" className="mb-1.5 block text-xs text-muted">
              Логин
            </label>
            <input
              id="login"
              type="text"
              autoComplete="username"
              className="w-full rounded-md border border-border bg-surface-2 px-3 py-2 text-sm outline-none focus:border-accent"
            />
          </div>
          <div>
            <label htmlFor="password" className="mb-1.5 block text-xs text-muted">
              Пароль
            </label>
            <input
              id="password"
              type="password"
              autoComplete="current-password"
              className="w-full rounded-md border border-border bg-surface-2 px-3 py-2 text-sm outline-none focus:border-accent"
            />
          </div>

          {notice && <p className="text-xs text-accent">{notice}</p>}

          <button
            type="submit"
            className="w-full rounded-md bg-accent px-3 py-2 text-sm font-medium text-black hover:opacity-90"
          >
            Войти
          </button>
        </form>
      </div>
    </div>
  );
}
