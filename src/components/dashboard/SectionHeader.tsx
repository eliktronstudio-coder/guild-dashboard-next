import type { ReactNode } from "react";

export default function SectionHeader({ title, right }: { title: string; right?: ReactNode }) {
  return (
    <div className="mb-4 flex items-center justify-between gap-3">
      <h2 className="font-heading text-[15px] font-semibold text-foreground">{title}</h2>
      {right}
    </div>
  );
}
