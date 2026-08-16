import type { ReactNode } from "react";

export default function SectionHeader({ title, right }: { title: string; right?: ReactNode }) {
  return (
    <div className="mb-3">
      <div className="flex items-baseline justify-between gap-3">
        <h2 className="text-sm font-semibold text-foreground">{title}</h2>
        {right}
      </div>
      <div className="brush-stroke mt-2" />
    </div>
  );
}
