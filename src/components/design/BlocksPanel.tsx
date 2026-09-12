"use client";

import { useState } from "react";
import {
  Plus,
  Copy,
  Trash2,
  Eye,
  EyeOff,
  Lock,
  Unlock,
  CornerDownRight,
  GripVertical,
  Bookmark,
  X,
} from "lucide-react";
import clsx from "clsx";
import {
  appendToSlot,
  moveBlock,
  patchBlock as patchBlockOp,
  extractBlock,
  findBlock,
  findSlotOf,
  type BlocksState,
  type DropPosition,
} from "@/lib/design/blockOps";
import { BREAKPOINTS, SLOTS, canContain, type Breakpoint, type BlockType, type DesignBlock, type SlotKey } from "@/lib/design/types";

export type { BlocksState };

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

export type Snippet = { id: string; name: string; createdAt: string };

type Props = {
  blocks: BlocksState;
  selectedId: string | null;
  onSelect: (elementId: string) => void;
  onChange: (next: BlocksState) => void;
  onDeleted: (restore: () => void) => void;
  snippets: Snippet[];
  onInsertSnippet: (snippetId: string, slot: SlotKey, parentId: string | null) => void;
  onSaveSnippet: (blockId: string, name: string) => void;
  onDeleteSnippet: (snippetId: string) => void;
};

export function newBlockId() {
  return `b${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
}

function makeBlock(type: BlockType): DesignBlock {
  const block: DesignBlock = { id: newBlockId(), type };
  if (type === "heading") block.text = "Новый заголовок";
  if (type === "text") block.text = "Новый текст";
  if (type === "button") {
    block.text = "Кнопка";
    block.href = "/dashboard";
  }
  return block;
}

function cloneBlock(block: DesignBlock): DesignBlock {
  return { ...block, id: newBlockId(), children: block.children?.map(cloneBlock) };
}

export default function BlocksPanel({
  blocks,
  selectedId,
  onSelect,
  onChange,
  onDeleted,
  snippets,
  onInsertSnippet,
  onSaveSnippet,
  onDeleteSnippet,
}: Props) {
  const [addingTo, setAddingTo] = useState<{ slot: SlotKey; parentId: string | null } | null>(null);
  const [dragId, setDragId] = useState<string | null>(null);
  const [dropHint, setDropHint] = useState<{ id: string; position: DropPosition } | null>(null);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [snippetName, setSnippetName] = useState("");

  function add(slot: SlotKey, parentId: string | null, type: BlockType) {
    const block = makeBlock(type);
    const next = parentId
      ? patchInsertChild(blocks, parentId, block)
      : appendToSlot(blocks, slot, block);
    onChange(next);
    setAddingTo(null);
    onSelect(`block.${block.id}`);
  }

  function patchInsertChild(state: BlocksState, parentId: string, block: DesignBlock): BlocksState {
    const parent = findBlock(state, parentId);
    if (!parent) return state;
    return patchBlockOp(state, parentId, { children: [...(parent.children ?? []), block] });
  }

  function duplicate(id: string) {
    const block = findBlock(blocks, id);
    const slot = findSlotOf(blocks, id);
    if (!block || !slot) return;
    onChange(appendToSlot(blocks, slot, cloneBlock(block)));
  }

  function remove(id: string) {
    const block = findBlock(blocks, id);
    if (!block || block.locked) return;
    const snapshot = blocks;
    onChange(extractBlock(blocks, id).state);
    // Удаление блока не затрагивает данные в базе — это только оформление.
    onDeleted(() => onChange(snapshot));
  }

  function patch(id: string, changes: Partial<DesignBlock>) {
    onChange(patchBlockOp(blocks, id, changes));
  }

  /** Куда упадёт блок: верхняя треть — до, нижняя — после, середина — внутрь. */
  function positionFromEvent(e: React.DragEvent, allowInside: boolean): DropPosition {
    const rect = e.currentTarget.getBoundingClientRect();
    const offset = (e.clientY - rect.top) / rect.height;
    if (allowInside && offset > 0.33 && offset < 0.67) return "inside";
    return offset < 0.5 ? "before" : "after";
  }

  function renderRow(block: DesignBlock, depth: number) {
    const elementId = `block.${block.id}`;
    const selected = selectedId === elementId;
    const hint = dropHint?.id === block.id ? dropHint.position : null;

    return (
      <div key={block.id}>
        <div
          draggable={!block.locked}
          onDragStart={(e) => {
            setDragId(block.id);
            e.dataTransfer.effectAllowed = "move";
            // Некоторые браузеры не начинают перенос без данных.
            e.dataTransfer.setData("text/plain", block.id);
          }}
          onDragEnd={() => {
            setDragId(null);
            setDropHint(null);
          }}
          onDragOver={(e) => {
            if (!dragId || dragId === block.id) return;
            e.preventDefault();
            setDropHint({ id: block.id, position: positionFromEvent(e, canContain(block.type)) });
          }}
          onDragLeave={() => {
            if (dropHint?.id === block.id) setDropHint(null);
          }}
          onDrop={(e) => {
            e.preventDefault();
            if (!dragId || dragId === block.id) return;
            const position = positionFromEvent(e, canContain(block.type));
            onChange(moveBlock(blocks, dragId, block.id, position));
            setDragId(null);
            setDropHint(null);
          }}
          className={clsx(
            "flex items-center gap-1 rounded px-1.5 py-1",
            selected ? "bg-accent-soft" : "hover:bg-surface-2",
            hint === "before" && "border-t-2 border-accent",
            hint === "after" && "border-b-2 border-accent",
            hint === "inside" && "ring-1 ring-accent",
            dragId === block.id && "opacity-40"
          )}
          style={{ paddingLeft: `${6 + depth * 12}px` }}
        >
          <span
            className="flex-shrink-0"
            title={block.locked ? "Блок заблокирован" : "Перетащите, чтобы переместить"}
          >
            <GripVertical
              size={11}
              className={block.locked ? "text-muted-2 opacity-40" : "cursor-grab text-muted-2"}
            />
          </span>
          <button
            type="button"
            onClick={() => onSelect(elementId)}
            className={clsx("min-w-0 flex-1 truncate text-left text-[11px]", selected ? "text-accent" : "text-foreground/80")}
          >
            {block.name || TYPE_LABEL[block.type]}
            {block.hidden && <span className="ml-1 text-muted-2">(скрыт)</span>}
          </button>

          <button type="button" title={block.hidden ? "Показать" : "Скрыть"}
            onClick={() => patch(block.id, { hidden: !block.hidden })}
            className="text-muted hover:text-foreground">
            {block.hidden ? <EyeOff size={11} /> : <Eye size={11} />}
          </button>
          <button type="button" title={block.locked ? "Разблокировать" : "Заблокировать"}
            onClick={() => patch(block.id, { locked: !block.locked })}
            className="text-muted hover:text-foreground">
            {block.locked ? <Lock size={11} /> : <Unlock size={11} />}
          </button>
          <button type="button" title="Сохранить как свой блок"
            onClick={() => {
              setSavingId(block.id);
              setSnippetName(block.name || TYPE_LABEL[block.type]);
            }}
            className="text-muted hover:text-accent">
            <Bookmark size={11} />
          </button>
          <button type="button" title="Дублировать" onClick={() => duplicate(block.id)}
            className="text-muted hover:text-foreground">
            <Copy size={11} />
          </button>
          {canContain(block.type) && (
            <button type="button" title="Добавить внутрь"
              onClick={() => setAddingTo({ slot: findSlotOf(blocks, block.id) ?? "top", parentId: block.id })}
              className="text-muted hover:text-accent">
              <CornerDownRight size={11} />
            </button>
          )}
          <button type="button" title={block.locked ? "Блок заблокирован" : "Удалить"}
            onClick={() => remove(block.id)} disabled={block.locked}
            className="text-muted hover:text-danger disabled:opacity-30">
            <Trash2 size={11} />
          </button>
        </div>

        {savingId === block.id && (
          <div className="mb-1 ml-4 flex items-center gap-1 rounded border border-border bg-surface-2 p-1.5">
            <input
              value={snippetName}
              onChange={(e) => setSnippetName(e.target.value)}
              placeholder="Название блока"
              className="min-w-0 flex-1 rounded border border-border bg-surface px-1.5 py-1 text-[10px] outline-none focus:border-accent"
            />
            <button
              type="button"
              onClick={() => {
                onSaveSnippet(block.id, snippetName.trim() || TYPE_LABEL[block.type]);
                setSavingId(null);
              }}
              className="rounded bg-accent px-1.5 py-1 text-[10px] font-semibold text-black"
            >
              Сохранить
            </button>
            <button type="button" onClick={() => setSavingId(null)} className="text-muted hover:text-foreground">
              <X size={11} />
            </button>
          </div>
        )}

        {block.children?.map((child) => renderRow(child, depth + 1))}
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <p className="text-[10px] text-muted-2">
        Блоки можно перетаскивать за <GripVertical size={9} className="inline" />: вверх или вниз строки — поставить
        рядом, в середину контейнера — вложить внутрь.
      </p>

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

                {snippets.length > 0 && (
                  <>
                    <p className="mb-1 mt-2 text-[10px] text-muted">Свои блоки:</p>
                    <div className="space-y-1">
                      {snippets.map((s) => (
                        <div key={s.id} className="flex items-center gap-1">
                          <button
                            type="button"
                            onClick={() => {
                              onInsertSnippet(s.id, slot.key, addingTo.parentId);
                              setAddingTo(null);
                            }}
                            className="min-w-0 flex-1 truncate rounded border border-border px-1.5 py-1 text-left text-[10px] hover:border-accent hover:text-accent"
                          >
                            {s.name}
                          </button>
                          <button
                            type="button"
                            title="Удалить заготовку"
                            onClick={() => onDeleteSnippet(s.id)}
                            className="flex-shrink-0 text-muted hover:text-danger"
                          >
                            <Trash2 size={10} />
                          </button>
                        </div>
                      ))}
                    </div>
                  </>
                )}

                <button
                  type="button"
                  onClick={() => setAddingTo(null)}
                  className="mt-1.5 text-[10px] text-muted hover:text-foreground"
                >
                  Отмена
                </button>
              </div>
            )}

            <div
              className="p-1"
              onDragOver={(e) => {
                // Пустая зона слота: разрешаем бросить в конец списка.
                if (dragId && list.length === 0) e.preventDefault();
              }}
              onDrop={(e) => {
                if (!dragId || list.length > 0) return;
                e.preventDefault();
                const extracted = extractBlock(blocks, dragId);
                if (extracted.block) onChange(appendToSlot(extracted.state, slot.key, extracted.block));
                setDragId(null);
                setDropHint(null);
              }}
            >
              {list.length === 0 ? (
                <p className="px-2 py-2 text-[10px] text-muted-2">Блоков нет. Можно перетащить сюда.</p>
              ) : (
                list.map((block) => renderRow(block, 0))
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
