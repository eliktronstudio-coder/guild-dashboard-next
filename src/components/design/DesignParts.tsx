import clsx from "clsx";
import { Fragment, type ReactNode } from "react";
import { resolveDesign } from "@/lib/design/resolve";
import { partsFor } from "@/lib/design/registry";
import { reconcileParts, type Breakpoint } from "@/lib/design/types";

/**
 * Раскладывает части внутри секции в порядке из конфига.
 *
 * Вложенный уровень той же схемы, что и DesignLayout: заголовок панели,
 * список, плитки — каждая часть остаётся обычным React-узлом, а конфиг
 * решает порядок и видимость. Поэтому «скрыть» ничего не удаляет.
 *
 * Фрагмент вместо обёртки: панели держат вертикальный ритм на space-y
 * родителя, и лишний div сбил бы отступы.
 */

function hiddenClasses(hiddenOn: Breakpoint[] | undefined): string {
  if (!hiddenOn || hiddenOn.length === 0) return "";
  return hiddenOn
    .map((bp) => {
      if (bp === "mobile") return "max-[767px]:hidden";
      if (bp === "tablet") return "max-[1023px]:min-[768px]:hidden";
      return "min-[1024px]:hidden";
    })
    .join(" ");
}

export default async function DesignParts({
  pageKey,
  sectionId,
  parts,
}: {
  pageKey: string;
  sectionId: string;
  /** id части -> её содержимое. Ключи должны совпадать с реестром. */
  parts: Record<string, ReactNode>;
}) {
  const design = await resolveDesign();
  const partIds = partsFor(pageKey, sectionId).map((p) => p.id);

  // Порядок из конфига, а без конфига — из реестра, то есть исходный вид.
  const order = reconcileParts(design.parts[sectionId], partIds);

  return (
    <>
      {order.map((entry) => {
        if (entry.hidden) return null;
        const node = parts[entry.id];
        if (!node) return null;
        const hide = hiddenClasses(entry.hiddenOn);
        // Без скрытия обёртки нет вообще: space-y родителя навешивает отступ
        // на прямых детей, а обёртка с display:contents этот отступ теряет.
        return hide ? (
          <div key={entry.id} className={clsx(hide)}>
            {node}
          </div>
        ) : (
          <Fragment key={entry.id}>{node}</Fragment>
        );
      })}
    </>
  );
}
