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
        <Link
          href="/dashboard"
          onClick={onCloseMobile}
          className="flex items-center gap-2.5 border-b border-border px-5 py-5"
        >
          <Logo size={30} />
          <span className="text-base font-semibold leading-tight tracking-tight">{guild.name} Guild</span>
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
                          "flex items-center gap-3 rounded-md border-l-2 py-2 pl-2.5 pr-3 text-sm transition-colors",
                          active
                            ? "border-accent bg-surface-2 text-accent-bright"
                            : "border-transparent text-foreground/80 hover:bg-surface-2 hover:text-foreground"
                        )}
                        style={active ? { boxShadow: "inset 0 0 24px -12px var(--accent)" } : undefined}
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
