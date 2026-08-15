"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import clsx from "clsx";
import { navSections } from "@/lib/nav";
import { guild } from "@/lib/config";
import Logo from "./Logo";
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

const numberFmt = new Intl.NumberFormat("ru-RU");

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
          "fixed inset-y-0 left-0 z-50 flex w-60 flex-col border-r border-border bg-surface/95 backdrop-blur-xl transition-transform lg:static lg:z-auto lg:translate-x-0",
          mobileOpen ? "translate-x-0" : "-translate-x-full"
        )}
      >
        <Link href="/dashboard" onClick={onCloseMobile} className="border-b border-border px-5 py-5">
          <Logo size="lg" />
        </Link>

        <nav className="flex-1 overflow-y-auto px-3 py-4">
          {navSections.map((section) => {
            const items = section.items.filter((item) => !item.adminOnly || user?.role === "admin");
            if (items.length === 0) return null;
            return (
            <div key={section.title} className="mb-6">
              <p className="px-3 pb-2 text-[11px] font-medium uppercase tracking-widest text-muted-2">
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
                          "flex items-center gap-3 rounded-lg border px-3 py-2.5 text-sm font-medium transition-colors",
                          active
                            ? "border-accent/40 bg-accent-soft text-accent-bright"
                            : "border-transparent text-foreground/75 hover:bg-surface-2 hover:text-foreground"
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

        <div className="border-t border-border px-4 pt-4">
          <div className="mb-1 flex items-baseline justify-between">
            <span className="text-xs font-semibold text-foreground">{guild.name} GUILD</span>
            <span className="text-[10px] text-muted">Уровень {guild.level}</span>
          </div>
          <div className="h-1.5 overflow-hidden rounded-full bg-surface-2">
            <div
              className="h-full rounded-full bg-gradient-to-r from-accent to-violet"
              style={{ width: `${Math.min(100, Math.round((guild.xp / guild.xpToNext) * 100))}%` }}
            />
          </div>
          <p className="mt-1 text-[10px] text-muted">
            {numberFmt.format(guild.xp)} / {numberFmt.format(guild.xpToNext)} XP
          </p>
        </div>

        <div className="p-4 pt-3">
          {user ? (
            <div className="space-y-2">
              <div className="flex items-center gap-2.5 rounded-lg bg-surface-2 px-3 py-2">
                <span className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-accent-soft text-xs font-semibold text-accent-bright">
                  {user.username.charAt(0).toUpperCase()}
                </span>
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
