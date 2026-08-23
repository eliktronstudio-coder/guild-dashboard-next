"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import clsx from "clsx";
import { navSections } from "@/lib/nav";
import { guild } from "@/lib/config";
import { accountRoleLabel, isFullAdminRole } from "@/lib/accountRoles";
import Logo from "./Logo";
import type { SessionPayload } from "@/lib/auth";

type SidebarProps = {
  mobileOpen: boolean;
  onCloseMobile: () => void;
  onLoginClick: () => void;
  user: SessionPayload | null;
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
          "fixed inset-y-0 left-0 z-50 flex w-[240px] flex-col border-r border-border bg-bg-sidebar transition-transform lg:static lg:z-auto lg:translate-x-0",
          mobileOpen ? "translate-x-0" : "-translate-x-full"
        )}
      >
        <Link href="/dashboard" onClick={onCloseMobile} className="flex items-center gap-2 border-b border-border px-5 py-5">
          <Logo size="lg" />
        </Link>

        <nav className="relative flex-1 overflow-y-auto px-3 py-4">
          {navSections.map((section) => {
            const items = section.items.filter((item) => !item.adminOnly || isFullAdminRole(user?.role));
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
                          "flex items-center gap-3 rounded-lg border px-4 py-3 text-sm font-medium transition-colors duration-150",
                          active
                            ? "border-accent/20 bg-accent-soft text-accent"
                            : "border-transparent text-muted hover:bg-white/[0.025] hover:text-foreground"
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

        <div className="px-4 pt-4">
          {(() => {
            const pct = Math.min(100, Math.round((guild.xp / guild.xpToNext) * 100));
            return (
              <>
                <div className="mb-2 flex items-baseline justify-between text-xs">
                  <span className="text-muted">Уровень {guild.level}</span>
                  <span className="text-accent">{pct}%</span>
                </div>
                <div className="h-1.5 overflow-hidden rounded-full bg-surface-2">
                  <div className="h-full rounded-full bg-accent" style={{ width: `${pct}%` }} />
                </div>
              </>
            );
          })()}
        </div>

        <div className="p-4 pt-4">
          {user ? (
            <div className="space-y-2">
              <div className="flex items-center justify-between gap-2.5 rounded-lg border border-border bg-surface-2 px-3 py-2.5">
                <div className="flex min-w-0 items-center gap-2.5">
                  <span className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-accent-soft text-xs font-semibold text-accent">
                    {user.username.charAt(0).toUpperCase()}
                  </span>
                  <div className="min-w-0">
                    <p className="truncate text-[13px] font-semibold text-foreground">{user.username}</p>
                    <p className="text-[11px] text-muted-2">{accountRoleLabel[user.role] ?? user.role}</p>
                  </div>
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
