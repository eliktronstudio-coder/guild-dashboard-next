"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import clsx from "clsx";
import { navSections } from "@/lib/nav";
import { guild } from "@/lib/config";
import Logo from "./Logo";
import JapaneseWavePattern from "./dashboard/JapaneseWavePattern";
import JapaneseCrest from "./dashboard/JapaneseCrest";
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
          "fixed inset-y-0 left-0 z-50 flex w-[230px] flex-col border-r border-border bg-bg-sidebar transition-transform lg:static lg:z-auto lg:translate-x-0",
          mobileOpen ? "translate-x-0" : "-translate-x-full"
        )}
        style={{ boxShadow: "inset -1px 0 0 rgba(216,160,77,0.08)" }}
      >
        <Link
          href="/dashboard"
          onClick={onCloseMobile}
          className="relative flex items-center gap-2 border-b border-border px-5 py-5"
        >
          <Logo size="lg" />
          <JapaneseCrest size={22} className="ml-auto text-accent-dim opacity-50" />
        </Link>

        <nav className="relative flex-1 overflow-y-auto px-3 py-4">
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
                          "relative flex items-center gap-3 rounded-lg border px-3 py-2.5 text-sm font-medium transition-colors duration-150",
                          active
                            ? "border-[rgba(190,72,55,0.42)] text-[#efb65f]"
                            : "border-transparent text-foreground/75 hover:bg-white/[0.025] hover:text-[#f1e8db]"
                        )}
                        style={
                          active
                            ? {
                                background:
                                  "linear-gradient(90deg, rgba(160,45,38,0.24), rgba(216,160,77,0.07))",
                              }
                            : undefined
                        }
                      >
                        {active && (
                          <span
                            aria-hidden="true"
                            className="absolute inset-y-1 left-0 w-[2px] rounded-full bg-[#c34a3d]"
                            style={{ boxShadow: "0 0 12px rgba(195,74,61,0.5)" }}
                          />
                        )}
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

        <div className="relative overflow-hidden border-t border-border px-4 pt-4">
          <JapaneseWavePattern className="left-0 right-0 top-0 h-full text-accent" opacity={0.04} />
          <div className="relative mb-1 flex items-baseline justify-between">
            <span className="text-xs font-semibold text-foreground">{guild.name} GUILD</span>
            <span className="text-[10px] text-muted">Уровень {guild.level}</span>
          </div>
          <div className="relative h-1.5 overflow-hidden rounded-full bg-surface-2">
            <div
              className="h-full rounded-full"
              style={{
                width: `${Math.min(100, Math.round((guild.xp / guild.xpToNext) * 100))}%`,
                background: "linear-gradient(90deg, var(--red), var(--accent))",
              }}
            />
          </div>
          <p className="relative mt-1 text-[10px] text-muted">
            {numberFmt.format(guild.xp)} / {numberFmt.format(guild.xpToNext)} XP
          </p>
        </div>

        <div className="p-4 pt-3">
          {user ? (
            <div className="space-y-2">
              <div className="flex items-center gap-2.5 rounded-lg bg-surface-2 px-3 py-2">
                <span className="relative flex h-8 w-8 flex-shrink-0 items-center justify-center text-xs font-semibold text-accent-bright">
                  <JapaneseCrest size={32} className="absolute inset-0 text-accent-dim opacity-70" />
                  <span className="relative">{user.username.charAt(0).toUpperCase()}</span>
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
