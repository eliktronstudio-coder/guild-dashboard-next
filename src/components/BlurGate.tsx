import type { ReactNode } from "react";

// Оборачивает контент, доступный только не-"random" ролям: страница
// открывается как обычно (навигация, структура видны), но содержимое
// внутри визуально размыто и не кликабельно, пока админ не назначит
// пользователю нормальную роль.
export default function BlurGate({ blurred, children }: { blurred: boolean; children: ReactNode }) {
  if (!blurred) return <>{children}</>;

  return (
    <div className="relative">
      <div aria-hidden="true" className="pointer-events-none select-none blur-md">
        {children}
      </div>
      <div className="pointer-events-none absolute inset-0 flex items-start justify-center pt-16">
        <span className="rounded-md border border-border bg-surface/95 px-3 py-1.5 text-xs text-muted shadow-lg">
          Доступно после назначения роли администратором
        </span>
      </div>
    </div>
  );
}
