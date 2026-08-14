"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import clsx from "clsx";
import { navSections } from "@/lib/nav";
import { guild } from "@/lib/config";

type SidebarProps = {
  mobileOpen: boolean;
  onCloseMobile: () => void;
  onLoginClick: () => void;
};

export default function Sidebar({ mobileOpen, onCloseMobile, onLoginClick }: SidebarProps) {
  const pathname = usePathname();

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
          className="flex items-center gap-2 border-b border-border px-5 py-5"
        >
          <span className="flex h-8 w-8 items-center justify-center rounded-md bg-accent-soft text-accent font-bold">
            {guild.name.charAt(0)}
          </span>
          <span className="font-semibold tracking-tight">{guild.name}</span>
        </Link>

        <nav className="flex-1 overflow-y-auto px-3 py-4">
          {navSections.map((section) => (
            <div key={section.title} className="mb-6">
              <p className="px-3 pb-2 text-xs font-medium uppercase tracking-wider text-muted">
                {section.title}
              </p>
              <ul className="space-y-1">
                {section.items.map((item) => {
                  const active = pathname === item.href || pathname.startsWith(item.href + "/");
                  const Icon = item.icon;
                  return (
                    <li key={item.href}>
                      <Link
                        href={item.href}
                        onClick={onCloseMobile}
                        className={clsx(
                          "flex items-center gap-3 rounded-md px-3 py-2 text-sm transition-colors",
                          active
                            ? "bg-accent-soft text-accent"
                            : "text-foreground/80 hover:bg-surface-2 hover:text-foreground"
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
          ))}
        </nav>

        <div className="border-t border-border p-4">
          <button
            type="button"
            onClick={onLoginClick}
            className="w-full rounded-md bg-accent px-3 py-2 text-sm font-medium text-black transition-opacity hover:opacity-90"
          >
            Войти
          </button>
        </div>
      </aside>
    </>
  );
}
