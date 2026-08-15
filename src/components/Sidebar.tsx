"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import clsx from "clsx";
import { navSections } from "@/lib/nav";
import { guild } from "@/lib/config";
import type { SessionPayload } from "@/lib/auth";

type SidebarProps = {
  mobileOpen: boolean;
  onCloseMobile: () => void;
  onLoginClick: () => void;
  user: SessionPayload | null;
};

const roleLabel: Record<string, string> = {
  admin: "Админ",
  member: "Участник",
};

export default function Sidebar({ mobileOpen, onCloseMobile, onLoginClick, user }: SidebarProps) {
  const pathname = usePathname();
  const router = useRouter();
  const [loggingOut, setLoggingOut] = useState(false);

  async function handleLogout() {
    setLoggingOut(true);
    await fetch("/api/auth/logout", { method: "POST" });
    router.refresh();
    setLoggingOut(false);
  }

  return (
    <>
      {mobileOpen && (
        <button
          aria-label="Закрыть меню"
          onClick={onCloseMobile}
          className="fixed inset-0 z-40 bg-black/60 lg:hidden"
        />
      )}
      <aside
        className={clsx(
          "fixed inset-y-0 left-0 z-50 flex w-64 flex-col border-r border-border bg-surface transition-transform lg:static lg:z-auto lg:translate-x-0",
          mobileOpen ? "translate-x-0" : "-translate-x-full"
        )}
      >
        <Link
          href="/dashboard"
          onClick={onCloseMobile}
          className="flex items-center gap-2.5 border-b border-border px-5 py-5"
        >
          <span className="flex h-8 w-8 flex-shrink-0 rotate-45 items-center justify-center border border-accent text-accent-bright">
            <span className="-rotate-45 font-display text-xs font-bold">{guild.name}</span>
          </span>
          <span>
            <span className="block font-display text-base font-bold leading-tight tracking-tight">
              Гильдия {guild.name}
            </span>
            <span className="block font-mono text-[10px] uppercase tracking-widest text-muted">
              учётная книга
            </span>
          </span>
        </Link>

        <nav className="flex-1 overflow-y-auto px-3 py-4">
          {navSections.map((section) => {
            const items = section.items.filter((item) => !item.adminOnly || user?.role === "admin");
            if (items.length === 0) return null;
            return (
            <div key={section.title} className="mb-6">
              <p className="px-3 pb-2 font-mono text-[10px] font-medium uppercase tracking-widest text-accent-dim">
                {section.title}
              </p>
              <ul className="space-y-0.5">
                {items.map((item) => {
                  const active = pathname === item.href || pathname.startsWith(item.href + "/");
                  const Icon = item.icon;
                  return (
                    <li key={item.href}>
                      <Link
                        href={item.href}
                        onClick={onCloseMobile}
                        className={clsx(
                          "flex items-center gap-3 border-l-2 px-3 py-2 text-sm transition-colors",
                          active
                            ? "border-accent bg-accent-soft text-accent-bright"
                            : "border-transparent text-foreground/80 hover:border-border-strong hover:bg-surface-2 hover:text-foreground"
                        )}
                      >
                        <Icon size={17} strokeWidth={2} />
                        <span>{item.label}</span>
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </div>
            );
          })}
        </nav>

        <div className="border-t border-border p-4">
          {user ? (
            <div className="space-y-2">
              <div className="flex items-center justify-between rounded-md bg-surface-2 px-3 py-2">
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium">{user.username}</p>
                  <p className="text-xs text-muted">{roleLabel[user.role] ?? user.role}</p>
                </div>
              </div>
              <button
                type="button"
                onClick={handleLogout}
                disabled={loggingOut}
                className="w-full rounded-md border border-border px-3 py-2 text-sm font-medium text-foreground/80 transition-colors hover:bg-surface-2 hover:text-foreground disabled:opacity-60"
              >
                Выйти
              </button>
            </div>
          ) : (
            <button
              type="button"
              onClick={onLoginClick}
              className="w-full rounded-md bg-accent px-3 py-2 text-sm font-medium text-black transition-opacity hover:opacity-90"
            >
              Войти
            </button>
          )}
        </div>
      </aside>
    </>
  );
}
