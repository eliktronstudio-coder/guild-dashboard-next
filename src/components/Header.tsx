"use client";

import { useState } from "react";
import { usePathname } from "next/navigation";
import { Menu } from "lucide-react";
import clsx from "clsx";
import { allNavItems, navSections } from "@/lib/nav";
import ThemeToggle from "./ThemeToggle";

type HeaderProps = {
  onMenuClick: () => void;
};

function useCurrentPage(pathname: string) {
  const item = allNavItems.find((i) => pathname === i.href || pathname.startsWith(i.href + "/"));
  const section = navSections.find((s) => s.items.includes(item!));
  return { label: item?.label ?? "Статистика", section: section?.title ?? "Обзор" };
}

export default function Header({ onMenuClick }: HeaderProps) {
  const pathname = usePathname();
  const { label, section } = useCurrentPage(pathname);
  const [lang, setLang] = useState<"ru" | "en">("ru");

  return (
    <header className="sticky top-0 z-30 flex items-center justify-between gap-4 overflow-hidden border-b border-border bg-background/95 px-4 py-4 backdrop-blur sm:px-6 relative">
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-y-[-60%] right-[-4%] w-64 opacity-40 mix-blend-screen"
        style={{ filter: "blur(36px)" }}
      >
        <svg viewBox="0 0 260 200" className="h-full w-full">
          <defs>
            <radialGradient id="hdrGlowA" cx="50%" cy="50%" r="50%">
              <stop offset="0%" stopColor="#7a4a72" stopOpacity="0.9" />
              <stop offset="100%" stopColor="#7a4a72" stopOpacity="0" />
            </radialGradient>
            <radialGradient id="hdrGlowB" cx="50%" cy="50%" r="50%">
              <stop offset="0%" stopColor="#4a2f52" stopOpacity="0.85" />
              <stop offset="100%" stopColor="#4a2f52" stopOpacity="0" />
            </radialGradient>
          </defs>
          <ellipse cx="190" cy="60" rx="130" ry="100" fill="url(#hdrGlowA)" />
          <ellipse cx="240" cy="130" rx="100" ry="80" fill="url(#hdrGlowB)" />
        </svg>
      </div>
      <div className="relative flex items-center gap-3">
        <button
          type="button"
          onClick={onMenuClick}
          aria-label="Меню"
          className="rounded-md border border-border p-2 text-foreground/80 hover:bg-surface-2 lg:hidden"
        >
          <Menu size={18} />
        </button>
        <div>
          <h1 className="text-lg font-semibold leading-tight">{label}</h1>
          <p className="text-xs text-muted">
            {section.toLowerCase()} / {label.toLowerCase()}
          </p>
        </div>
      </div>

      <div className="relative flex items-center gap-2">
        <div className="flex items-center gap-1 rounded-md border border-border p-1 text-xs">
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
      </div>
    </header>
  );
}
