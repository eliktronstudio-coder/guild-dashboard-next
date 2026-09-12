import type { ReactNode } from "react";
import { designText } from "@/lib/design/resolve";

/**
 * Заголовок панели. Если передан textId, подпись можно переопределить в
 * редакторе «Дизайн»: строка из кода остаётся значением по умолчанию.
 * Компонент серверный, поэтому читает переопределения напрямую.
 */
export default async function SectionHeader({
  title,
  right,
  textId,
}: {
  title: string;
  right?: ReactNode;
  textId?: string;
}) {
  const label = textId ? await designText(textId, title) : title;
  return (
    <div className="mb-4 flex items-center justify-between gap-3">
      <h2 data-design-el="shared.sectionTitle" className="font-heading text-[15px] font-semibold text-foreground">
        {label}
      </h2>
      {right}
    </div>
  );
}
