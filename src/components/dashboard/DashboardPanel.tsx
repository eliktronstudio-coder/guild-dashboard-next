import clsx from "clsx";
import Image from "next/image";
import type { ReactNode } from "react";

/**
 * Panel shell for the dashboard. With `art` it gets a photographic background
 * faded out to the left, matching the KPI cards — content always stays on the
 * dark side of the gradient so it remains readable.
 */
export default function DashboardPanel({
  children,
  className,
  art,
}: {
  children: ReactNode;
  className?: string;
  art?: string;
}) {
  return (
    <div
      className={clsx(
        "relative overflow-hidden rounded-2xl border border-border p-5",
        art ? "bg-surface-2" : "bg-surface",
        className
      )}
    >
      {art && (
        <div aria-hidden="true" className="pointer-events-none absolute inset-0">
          <Image src={art} alt="" fill sizes="(max-width: 1280px) 100vw, 50vw" className="object-cover" />
          <div
            className="absolute inset-0"
            style={{
              backgroundImage:
                "linear-gradient(90deg, rgba(var(--art-scrim),0.95) 0%, rgba(var(--art-scrim),0.88) 50%, rgba(var(--art-scrim),0.45) 80%, rgba(var(--art-scrim),0.18) 100%)",
            }}
          />
        </div>
      )}
      <div className="relative">{children}</div>
    </div>
  );
}
