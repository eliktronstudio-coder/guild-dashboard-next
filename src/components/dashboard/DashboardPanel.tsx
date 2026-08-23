import clsx from "clsx";
import type { ReactNode } from "react";

export default function DashboardPanel({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div
      className={clsx("rounded-xl border border-border bg-surface p-5", className)}
    >
      {children}
    </div>
  );
}
