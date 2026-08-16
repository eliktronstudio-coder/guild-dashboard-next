import clsx from "clsx";
import type { ReactNode } from "react";

export default function DashboardPanel({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div
      className={clsx(
        "relative overflow-hidden rounded-lg border border-border bg-surface/95 p-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.015),0_8px_30px_rgba(0,0,0,0.10)]",
        className
      )}
    >
      {children}
    </div>
  );
}
