"use client";

import { useState } from "react";
import { usePathname } from "next/navigation";
import { Menu } from "lucide-react";
import clsx from "clsx";
import { allNavItems, navSections } from "@/lib/nav";
import ThemeToggle from "./ThemeToggle";
import Logo from "./Logo";
import type { SessionPayload } from "@/lib/auth";

type HeaderProps = {
  onMenuClick: () => void;
  user: SessionPayload | null;
};

const roleLabel: Record<string, string> = {
  admin: "Админ",
  member: "Участник",
};

function useCurrentPage(pathname: string) {
  const item = allNavItems.find((i) => pathname === i.href || pathname.startsWith(i.href + "/"));
  const section = navSections.find((s) => s.items.includes(item!));
  return { label: item?.label ?? "Статистика", section: section?.title ?? "Обзор" };
}

export default function Header({ onMenuClick, user }: HeaderProps) {
  const pathname = usePathname();
  const { label, section } = useCurrentPage(pathname);
  const [lang, setLang] = useState<"ru" | "en">("ru");

  return (
    <header className="sticky top-0 z-30 flex items-center justify-between gap-4 border-b border-border bg-background/90 px-4 py-4 backdrop-blur sm:px-6">
      <div className="flex min-w-0 items-center gap-3">
        <button
          type="button"
          onClick={onMenuClick}
          aria-label="Меню"
          className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-md border border-border text-foreground/80 hover:bg-surface-2 lg:hidden"
        >
          <Menu size={18} />
        </button>
        <Logo size="sm" variant="mark" className="lg:hidden" />
        <div className="min-w-0">
          <h1 className="truncate text-lg font-semibold leading-tight">{label}</h1>
          <p className="truncate text-xs text-muted">
            {section.toLowerCase()} / {label.toLowerCase()}
          </p>
        </div>
      </div>

      <div className="flex items-center gap-2">
        <div className="hidden items-center gap-1 rounded-md border border-border p-1 text-xs sm:flex">
          {(["ru", "en"] as const).map((code) => (
            <button
              key={code}
              type="button"
              onClick={() => setLang(code)}
              className={clsx(
                "rounded px-2.5 py-1 font-medium uppercase transition-colors",
                lang === code ? "bg-accent text-black" : "text-muted hover:text-foreground"
              )}
            >
              {code}
            </button>
          ))}
        </div>
        <ThemeToggle />
        {user && (
          <div className="hidden items-center gap-2 rounded-md border border-border py-1 pl-1 pr-3 lg:flex">
            <span className="flex h-7 w-7 items-center justify-center rounded-full bg-accent-soft text-xs font-semibold text-accent-bright">
              {user.username.charAt(0).toUpperCase()}
            </span>
            <div className="leading-tight">
              <p className="text-xs font-medium">{user.username}</p>
              <p className="text-[10px] text-muted">{roleLabel[user.role] ?? user.role}</p>
            </div>
          </div>
        )}
      </div>
    </header>
  );
}
