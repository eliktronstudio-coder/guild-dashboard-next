"use client";

import { useState } from "react";
import { GripVertical, Eye, EyeOff, Layers, Boxes, ArrowUp, ArrowDown } from "lucide-react";
import clsx from "clsx";
import type { SectionDef } from "@/lib/design/registry";
import {
  BREAKPOINTS,
  reconcileParts,
  type Breakpoint,
  type DesignBlock,
  type LayoutEntry,
  type PartEntry,
} from "@/lib/design/types";

/**
 * Раскладка страницы: единый список рукописных секций и добавленных блоков.
 *
 * Здесь переставляют существующие панели, скрывают их (в том числе только на
 * телефоне) и решают, куда между ними встанут свои блоки. Сами секции живут в
 * коде страницы — конфиг задаёт только порядок и видимость, поэтому «скрыть»
 * ничего не удаляет и всегда обратимо.
 */
export default function LayoutPanel({
  layout,
  sections,
  blocks,
  selectedId,
  onSelect,
  onChange,
  parts,
  onPartsChange,
}: {
  layout: LayoutEntry[];
  sections: SectionDef[];
  /** Блоки верхнего уровня — те, что участвуют в раскладке. */
  blocks: DesignBlock[];
  selectedId: string | null;
  onSelect: (elementId: string) => void;
  onChange: (next: LayoutEntry[]) => void;
  /** Порядок частей по секциям. */
  parts: Record<string, PartEntry[]>;
  onPartsChange: (sectionId: string, next: PartEntry[]) => void;
}) {
  const [dragIndex, setDragIndex] = useState<number | null>(null);
  const [dropIndex, setDropIndex] = useState<number | null>(null);

  const sectionById = new Map(sections.map((s) => [s.id, s]));
  const blockById = new Map(blocks.map((b) => [b.id, b]));

  function move(from: number, to: number) {
    if (from === to || from < 0 || to < 0 || from >= layout.length || to > layout.length) return;
    const next = [...layout];
    const [item] = next.splice(from, 1);
    next.splice(from < to ? to - 1 : to, 0, item);
    onChange(next);
  }

  function patchSection(index: number, changes: Partial<Extract<LayoutEntry, { kind: "section" }>>) {
    const entry = layout[index];
    if (entry.kind !== "section") return;
    const next = [...layout];
    next[index] = { ...entry, ...changes };
    onChange(next);
  }

  if (sections.length === 0) {
    return (
      <p className="px-1 py-2 text-[11px] text-muted-2">
        Эта страница не разбита на секции — переставлять нечего. Свои блоки добавляются во вкладке «Блоки», над и
        под содержимым страницы.
      </p>
    );
  }

  return (
    <div className="space-y-2">
      <p className="text-[10px] text-muted-2">
        Перетаскивайте, чтобы менять порядок. «Глаз» скрывает секцию визуально — данные и код остаются на месте.
      </p>

      <div className="rounded-md border border-border p-1">
        {layout.map((entry, index) => {
          const isSection = entry.kind === "section";
          const def = isSection ? sectionById.get(entry.id) : undefined;
          const block = !isSection ? blockById.get(entry.id) : undefined;
          const label = isSection ? def?.label ?? entry.id : block?.name || "Добавленный блок";
          const elementId = isSection ? entry.id : `block.${entry.id}`;
          const hidden = isSection && entry.hidden;
          const hiddenOn = isSection ? entry.hiddenOn ?? [] : [];

          // Секция из раскладки могла исчезнуть из кода — reconcileLayout её
          // уберёт при следующем сохранении, но показывать её не нужно.
          if (isSection && !def) return null;
          if (!isSection && !block) return null;

          return (
            <div key={`${entry.kind}:${entry.id}`}>
              {dropIndex === index && <div className="mx-1 h-0.5 rounded bg-accent" />}
              <div
                draggable
                onDragStart={(e) => {
                  setDragIndex(index);
                  e.dataTransfer.effectAllowed = "move";
                  e.dataTransfer.setData("text/plain", String(index));
                }}
                onDragEnd={() => {
                  setDragIndex(null);
                  setDropIndex(null);
                }}
                onDragOver={(e) => {
                  if (dragIndex === null) return;
                  e.preventDefault();
                  const rect = e.currentTarget.getBoundingClientRect();
                  const after = e.clientY - rect.top > rect.height / 2;
                  setDropIndex(after ? index + 1 : index);
                }}
                onDrop={(e) => {
                  if (dragIndex === null) return;
                  e.preventDefault();
                  const rect = e.currentTarget.getBoundingClientRect();
                  const after = e.clientY - rect.top > rect.height / 2;
                  move(dragIndex, after ? index + 1 : index);
                  setDragIndex(null);
                  setDropIndex(null);
                }}
                className={clsx(
                  "flex items-center gap-1 rounded px-1.5 py-1.5",
                  selectedId === elementId ? "bg-accent-soft" : "hover:bg-surface-2",
                  dragIndex === index && "opacity-40"
                )}
              >
                <span className="flex-shrink-0 cursor-grab" title="Перетащите, чтобы переставить">
                  <GripVertical size={11} className="text-muted-2" />
                </span>
                <span className="flex-shrink-0" title={isSection ? "Секция страницы" : "Добавленный блок"}>
                  {isSection ? (
                    <Layers size={10} className="text-muted-2" />
                  ) : (
                    <Boxes size={10} className="text-accent" />
                  )}
                </span>
                <button
                  type="button"
                  onClick={() => onSelect(elementId)}
                  className={clsx(
                    "min-w-0 flex-1 truncate text-left text-[11px]",
                    selectedId === elementId ? "text-accent" : "text-foreground/80",
                    hidden && "line-through"
                  )}
                >
                  {label}
                </button>

                {isSection && (
                  <>
                    {hiddenOn.length > 0 && (
                      <span className="flex-shrink-0 text-[9px] text-muted-2" title="Скрыта на части устройств">
                        {hiddenOn.length} устр.
                      </span>
                    )}
                    <button
                      type="button"
                      title={hidden ? "Показать секцию" : "Скрыть секцию"}
                      onClick={() => patchSection(index, { hidden: !hidden })}
                      className="flex-shrink-0 text-muted hover:text-foreground"
                    >
                      {hidden ? <EyeOff size={11} /> : <Eye size={11} />}
                    </button>
                  </>
                )}
              </div>

              {/* Части секции: вложенный уровень раскладки. Показываем их у
                  выбранной секции, чтобы список не распухал. */}
              {isSection && selectedId === elementId && def?.parts && def.parts.length > 0 && (
                <PartsList
                  sectionId={entry.id}
                  partDefs={def.parts}
                  entries={reconcileParts(parts[entry.id], def.parts.map((x) => x.id))}
                  onChange={(next) => onPartsChange(entry.id, next)}
                />
              )}

              {/* Скрытие секции по устройствам — под строкой, чтобы не
                  распухала основная. */}
              {isSection && selectedId === elementId && (
                <div className="mb-1 ml-6 flex flex-wrap items-center gap-1 rounded border border-border bg-surface-2 p-1.5">
                  <span className="text-[10px] text-muted">Скрыть на:</span>
                  {BREAKPOINTS.map((bp) => {
                    const on = hiddenOn.includes(bp.key);
                    return (
                      <button
                        key={bp.key}
                        type="button"
                        onClick={() => {
                          const set = new Set<Breakpoint>(hiddenOn);
                          if (on) set.delete(bp.key);
                          else set.add(bp.key);
                          patchSection(index, { hiddenOn: set.size > 0 ? [...set] : undefined });
                        }}
                        className={clsx(
                          "rounded border px-1.5 py-0.5 text-[10px]",
                          on ? "border-danger text-danger" : "border-border text-muted hover:text-foreground"
                        )}
                      >
                        {bp.label}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
        {dropIndex === layout.length && <div className="mx-1 h-0.5 rounded bg-accent" />}
      </div>

      <SectionNotes sections={sections} />
    </div>
  );
}

/** Пояснения к секциям, у которых они заданы в реестре. */
function SectionNotes({ sections }: { sections: SectionDef[] }) {
  const notes = sections.filter((s) => s.note);
  if (notes.length === 0) return null;
  return (
    <ul className="space-y-0.5 px-1">
      {notes.map((s) => (
        <li key={s.id} className="text-[10px] text-muted-2">
          {s.label}: {s.note}
        </li>
      ))}
    </ul>
  );
}

/**
 * Части внутри секции: порядок и видимость. Перетаскивание тут не нужно —
 * частей мало, стрелки надёжнее и понятнее.
 */
function PartsList({
  sectionId,
  partDefs,
  entries,
  onChange,
}: {
  sectionId: string;
  partDefs: { id: string; label: string }[];
  entries: PartEntry[];
  onChange: (next: PartEntry[]) => void;
}) {
  const labelById = new Map(partDefs.map((p) => [p.id, p.label]));

  function move(index: number, delta: number) {
    const target = index + delta;
    if (target < 0 || target >= entries.length) return;
    const next = [...entries];
    [next[index], next[target]] = [next[target], next[index]];
    onChange(next);
  }

  function patch(index: number, changes: Partial<PartEntry>) {
    const next = [...entries];
    next[index] = { ...next[index], ...changes };
    onChange(next);
  }

  return (
    <div className="mb-1 ml-6 space-y-1 rounded border border-border bg-surface-2 p-1.5">
      <p className="text-[10px] text-muted">Части панели:</p>
      {entries.map((entry, index) => (
        <div key={`${sectionId}:${entry.id}`} className="flex items-center gap-1">
          <span
            className={clsx(
              "min-w-0 flex-1 truncate text-[10px]",
              entry.hidden ? "text-muted-2 line-through" : "text-foreground/80"
            )}
          >
            {labelById.get(entry.id) ?? entry.id}
          </span>
          <button
            type="button"
            title="Выше"
            onClick={() => move(index, -1)}
            disabled={index === 0}
            className="text-muted hover:text-foreground disabled:opacity-30"
          >
            <ArrowUp size={10} />
          </button>
          <button
            type="button"
            title="Ниже"
            onClick={() => move(index, 1)}
            disabled={index === entries.length - 1}
            className="text-muted hover:text-foreground disabled:opacity-30"
          >
            <ArrowDown size={10} />
          </button>
          <button
            type="button"
            title={entry.hidden ? "Показать часть" : "Скрыть часть"}
            onClick={() => patch(index, { hidden: !entry.hidden })}
            className="text-muted hover:text-foreground"
          >
            {entry.hidden ? <EyeOff size={10} /> : <Eye size={10} />}
          </button>
        </div>
      ))}
      <div className="flex flex-wrap gap-1">
        {entries.map((entry, index) => (
          <details key={`cfg-${entry.id}`} className="w-full">
            <summary className="cursor-pointer text-[10px] text-muted-2">
              {labelById.get(entry.id) ?? entry.id}: устройства
            </summary>
            <div className="flex flex-wrap gap-1 pl-2 pt-1">
              {BREAKPOINTS.map((bp) => {
                const on = (entry.hiddenOn ?? []).includes(bp.key);
                return (
                  <button
                    key={bp.key}
                    type="button"
                    onClick={() => {
                      const set = new Set<Breakpoint>(entry.hiddenOn ?? []);
                      if (on) set.delete(bp.key);
                      else set.add(bp.key);
                      patch(index, { hiddenOn: set.size > 0 ? [...set] : undefined });
                    }}
                    className={clsx(
                      "rounded border px-1.5 py-0.5 text-[10px]",
                      on ? "border-danger text-danger" : "border-border text-muted hover:text-foreground"
                    )}
                  >
                    {bp.label}
                  </button>
                );
              })}
            </div>
          </details>
        ))}
      </div>
    </div>
  );
}
