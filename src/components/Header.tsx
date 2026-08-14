"use client";

import { useState } from "react";
import { usePathname } from "next/navigation";
import { Menu } from "lucide-react";
import clsx from "clsx";
import { allNavItems, navSections } from "@/lib/nav";

type HeaderProps = {
  onMenuClick: () => void;
};

function useCurrentPage(pathname: string) {
  const item = allNavItems.find((i) => pathname === i.href || pathname.startsWith(i.href + "/"));
  const section = navSections.find((s) => s.items.includes(item!));
  return { label: item?.label ?? "Дашборд", section: section?.title ?? "Обзор" };
}

export default function Header({ onMenuClick }: HeaderProps) {
  const pathname = usePathname();
  const { label, section } = useCurrentPage(pathname);
  const [lang, setLang] = useState<"ru" | "en">("ru");

  return (
    <header className="sticky top-0 z-30 flex items-center justify-between gap-4 border-b border-border bg-background/95 px-4 py-4 backdrop-blur sm:px-6">
      <div className="flex items-center gap-3">
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
    </header>
  );
}
