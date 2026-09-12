import Link from "next/link";
import clsx from "clsx";
import { mediaUrl } from "@/lib/design/compile";
import { resolveDesign } from "@/lib/design/resolve";
import { sectionsFor } from "@/lib/design/registry";
import type { Breakpoint, DesignBlock, SlotKey } from "@/lib/design/types";

/**
 * Рендер блоков, добавленных администратором в редакторе «Дизайн».
 *
 * Блоки — это собственная структура страницы: они описаны конфигом, а не
 * кодом, поэтому их можно добавлять, переставлять и удалять из интерфейса.
 * Рукописное содержимое страницы блоками не является и остаётся на месте.
 *
 * Здесь нет dangerouslySetInnerHTML: текст выводится React-ом как текст, а
 * ссылки проверены при сохранении (isSafeHref в compile.ts).
 */

/** Классы «скрыть на устройстве» — границы совпадают с BREAKPOINTS. */
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

export function BlockNode({ block }: { block: DesignBlock }) {
  if (block.hidden) return null;

  const el = `block.${block.id}`;
  const hide = hiddenClasses(block.hiddenOn);
  const children = block.children?.map((child) => <BlockNode key={child.id} block={child} />);

  switch (block.type) {
    case "container":
      return (
        <div data-design-el={el} className={clsx("space-y-3", hide)}>
          {children}
        </div>
      );

    case "section":
      return (
        <section data-design-el={el} className={clsx("space-y-3 rounded-2xl border border-border bg-surface p-5", hide)}>
          {children}
        </section>
      );

    case "grid":
      return (
        <div data-design-el={el} className={clsx("grid grid-cols-1 gap-4 sm:grid-cols-2", hide)}>
          {children}
        </div>
      );

    case "heading":
      return (
        <h2 data-design-el={el} className={clsx("font-heading text-lg font-semibold text-foreground", hide)}>
          {block.text ?? ""}
        </h2>
      );

    case "text":
      return (
        <p data-design-el={el} className={clsx("text-sm text-muted", hide)}>
          {block.text ?? ""}
        </p>
      );

    case "image":
      if (!block.mediaId) return null;
      return (
        // next/image не нужен: файл отдаётся готовым и с вечным кешем через
        // /api/design/media/[id]/file.
        // eslint-disable-next-line @next/next/no-img-element
        <img
          data-design-el={el}
          src={mediaUrl(block.mediaId)}
          alt={block.alt ?? ""}
          className={clsx("max-w-full rounded-lg", hide)}
        />
      );

    case "button": {
      const href = block.href ?? "";
      const label = block.text ?? "Кнопка";
      const cls = clsx(
        "inline-flex items-center rounded-md bg-accent px-3 py-2 text-sm font-semibold text-black hover:bg-accent-bright",
        hide
      );
      if (!href) {
        return (
          <span data-design-el={el} className={cls}>
            {label}
          </span>
        );
      }
      if (href.startsWith("/")) {
        return (
          <Link data-design-el={el} data-xd-button="1" href={href} className={cls}>
            {label}
          </Link>
        );
      }
      return (
        <a data-design-el={el} data-xd-button="1" href={href} target="_blank" rel="noopener noreferrer" className={cls}>
          {label}
        </a>
      );
    }

    case "divider":
      return <hr data-design-el={el} className={clsx("border-border", hide)} />;

    case "spacer":
      return <div data-design-el={el} className={clsx("h-6", hide)} />;

    default:
      return null;
  }
}

export default async function DesignBlocks({ slot }: { slot: SlotKey }) {
  const design = await resolveDesign();

  // У страниц, разбитых на секции, порядком блоков управляет раскладка
  // (DesignLayout) — она вставляет их между секциями. Слоты там не нужны,
  // иначе блок отрисовался бы дважды.
  if (design.pageKey && sectionsFor(design.pageKey).length > 0) return null;

  const blocks = design.blocks[slot] ?? [];
  if (blocks.length === 0) return null;

  return (
    <div data-design-slot={slot} className={slot === "top" ? "mb-4 space-y-4" : "mt-4 space-y-4"}>
      {blocks.map((block) => (
        <BlockNode key={block.id} block={block} />
      ))}
    </div>
  );
}
