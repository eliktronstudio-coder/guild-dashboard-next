"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { LayoutDashboard, Swords, Users, Landmark, Wallet, Menu } from "lucide-react";
import clsx from "clsx";

const PRIMARY_ITEMS = [
  { href: "/dashboard", label: "Статистика", icon: LayoutDashboard },
  { href: "/activities", label: "Активность", icon: Swords },
  { href: "/players", label: "Состав", icon: Users },
  { href: "/treasury", label: "Казна", icon: Landmark },
  { href: "/payments", label: "Выплаты", icon: Wallet },
];

export default function BottomNav({ onMoreClick }: { onMoreClick: () => void }) {
  const pathname = usePathname();

  return (
    <nav
      className="fixed inset-x-0 bottom-0 z-40 flex items-stretch border-t border-border bg-surface/95 backdrop-blur lg:hidden"
      style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
    >
      {PRIMARY_ITEMS.map((item) => {
        const active = pathname === item.href || pathname.startsWith(item.href + "/");
        const Icon = item.icon;
        return (
          <Link
            key={item.href}
            href={item.href}
            className={clsx(
              "flex min-h-[56px] flex-1 flex-col items-center justify-center gap-0.5 text-[10px] font-medium",
              active ? "text-accent-bright" : "text-muted"
            )}
          >
            <Icon size={20} strokeWidth={active ? 2.4 : 2} />
            <span>{item.label}</span>
          </Link>
        );
      })}
      <button
        type="button"
        onClick={onMoreClick}
        aria-label="Ещё"
        className="flex min-h-[56px] flex-1 flex-col items-center justify-center gap-0.5 text-[10px] font-medium text-muted"
      >
        <Menu size={20} />
        <span>Ещё</span>
      </button>
    </nav>
  );
}
