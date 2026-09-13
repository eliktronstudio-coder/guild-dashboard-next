import clsx from "clsx";
import { Fragment, type ReactNode } from "react";
import { resolveDesign } from "@/lib/design/resolve";
import { sectionsFor } from "@/lib/design/registry";
import { reconcileLayout, type Breakpoint, type DesignBlock, type SlotKey } from "@/lib/design/types";
import { BlockNode } from "./DesignBlocks";

/**
 * Рендерит содержимое страницы в порядке, заданном раскладкой из конфига.
 *
 * Секции — это обычные React-узлы, которые страница передаёт в `sections`:
 * загрузка данных и внутреннее устройство остаются в коде. Конфиг решает
 * только порядок, видимость и то, куда между секциями встают добавленные
 * администратором блоки.
 *
 * Если раскладка не задана, порядок берётся из реестра — то есть совпадает
 * с исходным видом страницы.
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

export default async function DesignLayout({
  pageKey,
  sections,
  className,
  designId,
}: {
  pageKey: string;
  /** id секции -> её содержимое. Ключи должны совпадать с реестром. */
  sections: Record<string, ReactNode>;
  className?: string;
  /** Идентификатор оформления для самой обёртки раскладки. */
  designId?: string;
}) {
  const design = await resolveDesign();

  const sectionIds = sectionsFor(pageKey).map((s) => s.id);
  const topLevelBlocks: DesignBlock[] = (["top", "bottom"] as SlotKey[]).flatMap(
    (slot) => design.blocks[slot] ?? []
  );
  const blockById = new Map(topLevelBlocks.map((b) => [b.id, b]));

  // Раскладка приходит уже сведённой с реестром, но страница может
  // рендериться и без конфига — тогда собираем порядок из реестра.
  const layout = reconcileLayout(
    design.layout && design.layout.length > 0 ? design.layout : [],
    sectionIds,
    topLevelBlocks.map((b) => b.id)
  );

  return (
    <div data-design-el={designId} className={className}>
      {layout.map((entry) => {
        if (entry.kind === "section") {
          if (entry.hidden) return null;
          const node = sections[entry.id];
          if (!node) return null;
          const hide = hiddenClasses(entry.hiddenOn);
          // Обёртка нужна только когда секцию скрывают по устройствам:
          // иначе лишний div сломал бы сетку страницы.
          // Обёртка только для скрытия по устройствам: display:contents
          // оставляет секцию прямым участником сетки, а display:none её
          // убирает. Без скрытия обёртка не нужна вовсе.
          return hide ? (
            <div key={entry.id} className={clsx("contents", hide)}>
              {node}
            </div>
          ) : (
            <Fragment key={entry.id}>{node}</Fragment>
          );
        }

        const block = blockById.get(entry.id);
        if (!block) return null;
        return <BlockNode key={block.id} block={block} />;
      })}
    </div>
  );
}
