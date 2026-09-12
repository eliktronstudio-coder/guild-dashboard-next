"use client";

import { useState } from "react";
import {
  Plus,
  Copy,
  Trash2,
  ChevronUp,
  ChevronDown,
  Eye,
  EyeOff,
  Lock,
  Unlock,
  CornerDownRight,
} from "lucide-react";
import clsx from "clsx";
import {
  BREAKPOINTS,
  SLOTS,
  canContain,
  type Breakpoint,
  type BlockType,
  type DesignBlock,
  type SlotKey,
} from "@/lib/design/types";

/** Библиотека блоков: что можно добавить на страницу. */
export const BLOCK_LIBRARY: { type: BlockType; label: string; hint: string }[] = [
  { type: "section", label: "Секция", hint: "Панель с рамкой и отступами" },
  { type: "container", label: "Контейнер", hint: "Обёртка без оформления" },
  { type: "grid", label: "Сетка", hint: "Две колонки на широком экране" },
  { type: "heading", label: "Заголовок", hint: "Крупный текст" },
  { type: "text", label: "Текст", hint: "Абзац" },
  { type: "image", label: "Изображение", hint: "Файл из медиатеки" },
  { type: "button", label: "Кнопка", hint: "Ссылка на раздел сайта" },
  { type: "divider", label: "Разделитель", hint: "Горизонтальная линия" },
  { type: "spacer", label: "Отступ", hint: "Пустое место" },
];

const TYPE_LABEL: Record<BlockType, string> = Object.fromEntries(
  BLOCK_LIBRARY.map((b) => [b.type, b.label])
) as Record<BlockType, string>;

export type BlocksState = Partial<Record<SlotKey, DesignBlock[]>>;

type Props = {
  blocks: BlocksState;
  selectedId: string | null;
  onSelect: (elementId: string) => void;
  onChange: (next: BlocksState) => void;
  /** Последнее удаление — для «Вернуть». */
  onDeleted: (restore: () => void) => void;
};

function newId() {
  // Короткий устойчивый идентификатор: попадает в data-design-el и в конфиг.
  return `b${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
}

function makeBlock(type: BlockType): DesignBlock {
  const block: DesignBlock = { id: newId(), type };
  if (type === "heading") block.text = "Новый заголовок";
  if (type === "text") block.text = "Новый текст";
  if (type === "button") {
    block.text = "Кнопка";
    block.href = "/dashboard";
  }
  return block;
}

function cloneBlock(block: DesignBlock): DesignBlock {
  return {
    ...block,
    id: newId(),
    children: block.children?.map(cloneBlock),
  };
}

/** Рекурсивно заменяет список по пути. */
function updateList(
  list: DesignBlock[],
  parentId: string | null,
  transform: (items: DesignBlock[]) => DesignBlock[]
): DesignBlock[] {
  if (parentId === null) return transform(list);
  return list.map((item) => {
    if (item.id === parentId) {
      return { ...item, children: transform(item.children ?? []) };
    }
    if (item.children?.length) {
      return { ...item, children: updateList(item.children, parentId, transform) };
    }
    return item;
  });
}

function findParentId(list: DesignBlock[], id: string, parent: string | null = null): string | null | undefined {
  for (const item of list) {
    if (item.id === id) return parent;
    if (item.children?.length) {
      const found = findParentId(item.children, id, item.id);
      if (found !== undefined) return found;
    }
  }
  return undefined;
}

function findBlock(list: DesignBlock[], id: string): DesignBlock | null {
  for (const item of list) {
    if (item.id === id) return item;
    if (item.children?.length) {
      const found = findBlock(item.children, id);
      if (found) return found;
    }
  }
  return null;
}

export default function BlocksPanel({ blocks, selectedId, onSelect, onChange, onDeleted }: Props) {
  const [addingTo, setAddingTo] = useState<{ slot: SlotKey; parentId: string | null } | null>(null);

  function mutateSlot(slot: SlotKey, parentId: string | null, transform: (items: DesignBlock[]) => DesignBlock[]) {
    const current = blocks[slot] ?? [];
    onChange({ ...blocks, [slot]: updateList(current, parentId, transform) });
  }

  function add(slot: SlotKey, parentId: string | null, type: BlockType) {
    const block = makeBlock(type);
    mutateSlot(slot, parentId, (items) => [...items, block]);
    setAddingTo(null);
    onSelect(`block.${block.id}`);
  }

  function duplicate(slot: SlotKey, id: string) {
    const parentId = findParentId(blocks[slot] ?? [], id) ?? null;
    mutateSlot(slot, parentId, (items) => {
      const index = items.findIndex((i) => i.id === id);
      if (index < 0) return items;
      const copy = cloneBlock(items[index]);
      return [...items.slice(0, index + 1), copy, ...items.slice(index + 1)];
    });
  }

  function remove(slot: SlotKey, id: string) {
    const snapshot = blocks;
    const parentId = findParentId(blocks[slot] ?? [], id) ?? null;
    const block = findBlock(blocks[slot] ?? [], id);
    if (block?.locked) return;
    mutateSlot(slot, parentId, (items) => items.filter((i) => i.id !== id));
    // Удаление блока не затрагивает данные в базе — это только оформление,
    // поэтому достаточно возможности вернуть предыдущее состояние.
    onDeleted(() => onChange(snapshot));
  }

  function move(slot: SlotKey, id: string, delta: number) {
    const parentId = findParentId(blocks[slot] ?? [], id) ?? null;
    mutateSlot(slot, parentId, (items) => {
      const index = items.findIndex((i) => i.id === id);
      const target = index + delta;
      if (index < 0 || target < 0 || target >= items.length) return items;
      const next = [...items];
      [next[index], next[target]] = [next[target], next[index]];
      return next;
    });
  }

  function patch(slot: SlotKey, id: string, changes: Partial<DesignBlock>) {
    const parentId = findParentId(blocks[slot] ?? [], id) ?? null;
    mutateSlot(slot, parentId, (items) => items.map((i) => (i.id === id ? { ...i, ...changes } : i)));
  }

  function renderRow(slot: SlotKey, block: DesignBlock, depth: number, index: number, total: number) {
    const elementId = `block.${block.id}`;
    const selected = selectedId === elementId;
    return (
      <div key={block.id}>
        <div
          className={clsx(
            "flex items-center gap-1 rounded px-1.5 py-1",
            selected ? "bg-accent-soft" : "hover:bg-surface-2"
          )}
          style={{ paddingLeft: `${6 + depth * 12}px` }}
        >
          <button
            type="button"
            onClick={() => onSelect(elementId)}
            className={clsx("min-w-0 flex-1 truncate text-left text-[11px]", selected ? "text-accent" : "text-foreground/80")}
          >
            {block.name || TYPE_LABEL[block.type]}
            {block.hidden && <span className="ml-1 text-muted-2">(скрыт)</span>}
          </button>

          <button type="button" title="Выше" onClick={() => move(slot, block.id, -1)} disabled={index === 0}
            className="text-muted hover:text-foreground disabled:opacity-30">
            <ChevronUp size={11} />
          </button>
          <button type="button" title="Ниже" onClick={() => move(slot, block.id, 1)} disabled={index === total - 1}
            className="text-muted hover:text-foreground disabled:opacity-30">
            <ChevronDown size={11} />
          </button>
          <button type="button" title={block.hidden ? "Показать" : "Скрыть"}
            onClick={() => patch(slot, block.id, { hidden: !block.hidden })}
            className="text-muted hover:text-foreground">
            {block.hidden ? <EyeOff size={11} /> : <Eye size={11} />}
          </button>
          <button type="button" title={block.locked ? "Разблокировать" : "Заблокировать"}
            onClick={() => patch(slot, block.id, { locked: !block.locked })}
            className="text-muted hover:text-foreground">
            {block.locked ? <Lock size={11} /> : <Unlock size={11} />}
          </button>
          <button type="button" title="Дублировать" onClick={() => duplicate(slot, block.id)}
            className="text-muted hover:text-foreground">
            <Copy size={11} />
          </button>
          {canContain(block.type) && (
            <button type="button" title="Добавить внутрь"
              onClick={() => setAddingTo({ slot, parentId: block.id })}
              className="text-muted hover:text-accent">
              <CornerDownRight size={11} />
            </button>
          )}
          <button type="button" title={block.locked ? "Блок заблокирован" : "Удалить"}
            onClick={() => remove(slot, block.id)} disabled={block.locked}
            className="text-muted hover:text-danger disabled:opacity-30">
            <Trash2 size={11} />
          </button>
        </div>

        {block.children?.map((child, i) =>
          renderRow(slot, child, depth + 1, i, block.children!.length)
        )}
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {SLOTS.map((slot) => {
        const list = blocks[slot.key] ?? [];
        return (
          <div key={slot.key} className="rounded-md border border-border">
            <div className="flex items-center justify-between gap-2 border-b border-border px-2 py-1.5">
              <span className="text-[11px] font-medium">{slot.label}</span>
              <button
                type="button"
                onClick={() => setAddingTo({ slot: slot.key, parentId: null })}
                className="flex items-center gap-1 text-[10px] text-accent hover:underline"
              >
                <Plus size={11} /> Добавить
              </button>
            </div>

            {addingTo?.slot === slot.key && (
              <div className="border-b border-border bg-surface-2 p-2">
                <p className="mb-1.5 text-[10px] text-muted">
                  {addingTo.parentId ? "Добавить внутрь выбранного блока:" : "Выберите блок:"}
                </p>
                <div className="grid grid-cols-2 gap-1">
                  {BLOCK_LIBRARY.map((item) => (
                    <button
                      key={item.type}
                      type="button"
                      onClick={() => add(slot.key, addingTo.parentId, item.type)}
                      title={item.hint}
                      className="rounded border border-border px-1.5 py-1 text-left text-[10px] hover:border-accent hover:text-accent"
                    >
                      {item.label}
                    </button>
                  ))}
                </div>
                <button
                  type="button"
                  onClick={() => setAddingTo(null)}
                  className="mt-1.5 text-[10px] text-muted hover:text-foreground"
                >
                  Отмена
                </button>
              </div>
            )}

            <div className="p-1">
              {list.length === 0 ? (
                <p className="px-2 py-2 text-[10px] text-muted-2">Блоков нет.</p>
              ) : (
                list.map((block, i) => renderRow(slot.key, block, 0, i, list.length))
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}

/** Настройки выбранного блока: текст, ссылка, картинка, скрытие по устройствам. */
export function BlockSettings({
  block,
  slot,
  onPatch,
  onPickMedia,
}: {
  block: DesignBlock;
  slot: SlotKey;
  onPatch: (changes: Partial<DesignBlock>) => void;
  onPickMedia: () => void;
}) {
  const disabled = Boolean(block.locked);

  return (
    <div className="space-y-2.5 border-b border-border p-3">
      <p className="text-[11px] font-medium text-foreground">
        Блок: {block.name || TYPE_LABEL[block.type]}
        <span className="ml-1 font-normal text-muted-2">({slot === "top" ? "сверху" : "снизу"})</span>
      </p>

      <label className="block text-[11px] text-muted">
        Имя в дереве
        <input
          value={block.name ?? ""}
          disabled={disabled}
          placeholder={TYPE_LABEL[block.type]}
          onChange={(e) => onPatch({ name: e.target.value })}
          className="mt-1 w-full rounded-md border border-border bg-surface-2 px-2 py-1.5 text-xs outline-none focus:border-accent disabled:opacity-50"
        />
      </label>

      {(block.type === "heading" || block.type === "text" || block.type === "button") && (
        <label className="block text-[11px] text-muted">
          Текст
          <textarea
            value={block.text ?? ""}
            disabled={disabled}
            rows={block.type === "text" ? 3 : 1}
            onChange={(e) => onPatch({ text: e.target.value })}
            className="mt-1 w-full rounded-md border border-border bg-surface-2 px-2 py-1.5 text-xs outline-none focus:border-accent disabled:opacity-50"
          />
        </label>
      )}

      {block.type === "button" && (
        <label className="block text-[11px] text-muted">
          Ссылка
          <input
            value={block.href ?? ""}
            disabled={disabled}
            placeholder="/dashboard или https://…"
            onChange={(e) => onPatch({ href: e.target.value })}
            className="mt-1 w-full rounded-md border border-border bg-surface-2 px-2 py-1.5 text-xs outline-none focus:border-accent disabled:opacity-50"
          />
          <span className="mt-1 block text-[10px] text-muted-2">
            Допустимы внутренние маршруты и адреса https. Скрипты вставить нельзя.
          </span>
        </label>
      )}

      {block.type === "image" && (
        <div className="space-y-1.5">
          <span className="block text-[11px] text-muted">Файл</span>
          {block.mediaId ? (
            <div className="flex items-center gap-2">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={`/api/design/media/${block.mediaId}/file`}
                alt=""
                className="h-10 w-10 rounded border border-border object-cover"
              />
              <button type="button" onClick={onPickMedia} disabled={disabled}
                className="rounded-md border border-border px-2 py-1 text-[10px] hover:text-accent disabled:opacity-50">
                Заменить
              </button>
              <button type="button" onClick={() => onPatch({ mediaId: undefined })} disabled={disabled}
                className="text-[10px] text-muted hover:text-danger disabled:opacity-50">
                Убрать
              </button>
            </div>
          ) : (
            <button type="button" onClick={onPickMedia} disabled={disabled}
              className="rounded-md border border-border px-2 py-1 text-[10px] hover:text-accent disabled:opacity-50">
              Выбрать из медиатеки
            </button>
          )}
          <label className="block text-[11px] text-muted">
            Замещающий текст
            <input
              value={block.alt ?? ""}
              disabled={disabled}
              onChange={(e) => onPatch({ alt: e.target.value })}
              className="mt-1 w-full rounded-md border border-border bg-surface-2 px-2 py-1.5 text-xs outline-none focus:border-accent disabled:opacity-50"
            />
          </label>
        </div>
      )}

      <div>
        <span className="mb-1 block text-[11px] text-muted">Скрыть на устройствах</span>
        <div className="flex flex-wrap gap-1.5">
          {BREAKPOINTS.map((bp) => {
            const on = (block.hiddenOn ?? []).includes(bp.key);
            return (
              <button
                key={bp.key}
                type="button"
                disabled={disabled}
                onClick={() => {
                  const set = new Set<Breakpoint>(block.hiddenOn ?? []);
                  if (on) set.delete(bp.key);
                  else set.add(bp.key);
                  onPatch({ hiddenOn: set.size > 0 ? [...set] : undefined });
                }}
                className={clsx(
                  "rounded border px-1.5 py-1 text-[10px] disabled:opacity-50",
                  on ? "border-danger text-danger" : "border-border text-muted hover:text-foreground"
                )}
              >
                {bp.label}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
