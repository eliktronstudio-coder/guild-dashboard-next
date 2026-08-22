"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Hourglass } from "lucide-react";
import type { SessionPayload } from "@/lib/auth";

export default function PendingApproval({ user }: { user: SessionPayload }) {
  const router = useRouter();
  const [loggingOut, setLoggingOut] = useState(false);

  async function handleLogout() {
    setLoggingOut(true);
    await fetch("/api/auth/logout", { method: "POST" });
    router.refresh();
    setLoggingOut(false);
  }

  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-4 px-4 text-center">
      <Hourglass size={40} className="text-muted" />
      <div>
        <h1 className="text-lg font-semibold">Заявка на рассмотрении</h1>
        <p className="mt-1 max-w-sm text-sm text-muted">
          Аккаунт «{user.username}» зарегистрирован, но роль ещё не назначена. Обратитесь к администратору гильдии —
          доступ откроется после назначения роли.
        </p>
      </div>
      <button
        type="button"
        onClick={handleLogout}
        disabled={loggingOut}
        className="rounded-md border border-border px-4 py-2 text-sm font-medium text-foreground/80 hover:bg-surface-2 hover:text-foreground disabled:opacity-60"
      >
        Выйти
      </button>
    </div>
  );
}
