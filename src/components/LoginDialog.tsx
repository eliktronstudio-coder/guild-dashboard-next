"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { X } from "lucide-react";
import clsx from "clsx";
import { ROLES } from "@/lib/roles";

type LoginDialogProps = {
  open: boolean;
  onClose: () => void;
};

type Mode = "login" | "register";

const GAME_ROLES = ROLES.filter((r) => r !== "Без роли");

export default function LoginDialog({ open, onClose }: LoginDialogProps) {
  const router = useRouter();
  const [mode, setMode] = useState<Mode>("login");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [nickname, setNickname] = useState("");
  const [role, setRole] = useState(GAME_ROLES[0]);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  if (!open) return null;

  function reset() {
    setUsername("");
    setPassword("");
    setConfirmPassword("");
    setNickname("");
    setRole(GAME_ROLES[0]);
    setError(null);
    setSubmitting(false);
  }

  function handleClose() {
    reset();
    setMode("login");
    onClose();
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);

    if (mode === "register" && password !== confirmPassword) {
      setError("Пароли не совпадают.");
      return;
    }

    setSubmitting(true);
    try {
      const body =
        mode === "register" ? { username, password, nickname, role } : { username, password };
      const res = await fetch(`/api/auth/${mode}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Что-то пошло не так.");
        setSubmitting(false);
        return;
      }
      handleClose();
      router.refresh();
    } catch {
      setError("Не удалось связаться с сервером.");
      setSubmitting(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <button aria-label="Закрыть" onClick={handleClose} className="fixed inset-0 bg-black/70" />
      <div className="relative z-10 w-full max-w-sm rounded-lg border border-border bg-surface p-6 shadow-xl">
        <div className="mb-5 flex items-center justify-between">
          <div className="flex gap-1 rounded-md border border-border p-1 text-xs">
            <button
              type="button"
              onClick={() => {
                setMode("login");
                setError(null);
              }}
              className={clsx(
                "rounded px-2.5 py-1 font-medium transition-colors",
                mode === "login" ? "bg-accent text-black" : "text-muted hover:text-foreground"
              )}
            >
              Вход
            </button>
            <button
              type="button"
              onClick={() => {
                setMode("register");
                setError(null);
              }}
              className={clsx(
                "rounded px-2.5 py-1 font-medium transition-colors",
                mode === "register" ? "bg-accent text-black" : "text-muted hover:text-foreground"
              )}
            >
              Регистрация
            </button>
          </div>
          <button
            type="button"
            onClick={handleClose}
            aria-label="Закрыть"
            className="rounded p-1 text-muted hover:bg-surface-2 hover:text-foreground"
          >
            <X size={18} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label htmlFor="username" className="mb-1.5 block text-xs text-muted">
              Логин
            </label>
            <input
              id="username"
              type="text"
              autoComplete="username"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              required
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
              autoComplete={mode === "login" ? "current-password" : "new-password"}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              minLength={6}
              className="w-full rounded-md border border-border bg-surface-2 px-3 py-2 text-sm outline-none focus:border-accent"
            />
          </div>
          {mode === "register" && (
            <>
              <div>
                <label htmlFor="confirmPassword" className="mb-1.5 block text-xs text-muted">
                  Повторите пароль
                </label>
                <input
                  id="confirmPassword"
                  type="password"
                  autoComplete="new-password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  required
                  minLength={6}
                  className="w-full rounded-md border border-border bg-surface-2 px-3 py-2 text-sm outline-none focus:border-accent"
                />
              </div>
              <div>
                <label htmlFor="nickname" className="mb-1.5 block text-xs text-muted">
                  Игровой ник
                </label>
                <input
                  id="nickname"
                  type="text"
                  value={nickname}
                  onChange={(e) => setNickname(e.target.value)}
                  required
                  maxLength={40}
                  className="w-full rounded-md border border-border bg-surface-2 px-3 py-2 text-sm outline-none focus:border-accent"
                />
              </div>
              <div>
                <label htmlFor="role" className="mb-1.5 block text-xs text-muted">
                  Роль
                </label>
                <select
                  id="role"
                  value={role}
                  onChange={(e) => setRole(e.target.value)}
                  className="w-full rounded-md border border-border bg-surface-2 px-3 py-2 text-sm outline-none focus:border-accent"
                >
                  {GAME_ROLES.map((r) => (
                    <option key={r} value={r}>
                      {r}
                    </option>
                  ))}
                </select>
              </div>
            </>
          )}

          {error && <p className="text-xs text-danger">{error}</p>}

          <button
            type="submit"
            disabled={submitting}
            className="w-full rounded-md bg-accent px-3 py-2 text-sm font-medium text-black hover:opacity-90 disabled:opacity-60"
          >
            {mode === "login" ? "Войти" : "Зарегистрироваться"}
          </button>
        </form>
      </div>
    </div>
  );
}
