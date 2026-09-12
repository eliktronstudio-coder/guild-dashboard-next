"use client";

import { useMemo, useState } from "react";
import { RotateCcw, ChevronDown } from "lucide-react";
import clsx from "clsx";
import {
  PROPERTIES,
  PROPERTY_GROUPS,
  isValidValue,
  type PropertyDef,
  type PropertyGroupKey,
} from "@/lib/design/properties";
import { readValue, type Breakpoint, type ElementValues, type StateKey } from "@/lib/design/types";

type Props = {
  elementId: string;
  elementLabel: string;
  scopeLabel: string;
  values: ElementValues | undefined;
  breakpoint: Breakpoint;
  state: StateKey;
  onChange: (prop: string, value: string) => void;
  onResetProp: (prop: string) => void;
  locked: boolean;
  onPickMedia?: (prop: string) => void;
};

/** Цветовое поле: палитра проекта + произвольное значение. */
const THEME_COLOR_SUGGESTIONS = [
  "var(--accent)",
  "var(--accent-bright)",
  "var(--accent-dim)",
  "var(--foreground)",
  "var(--muted)",
  "var(--surface)",
  "var(--surface-2)",
  "var(--border)",
  "var(--danger)",
  "var(--success)",
  "var(--info)",
  "var(--jade)",
  "transparent",
];

function Field({
  def,
  current,
  inherited,
  onChange,
  onReset,
  disabled,
  onPickMedia,
}: {
  def: PropertyDef;
  current: string;
  inherited: boolean;
  onChange: (value: string) => void;
  onReset: () => void;
  disabled: boolean;
  onPickMedia?: () => void;
}) {
  const [draft, setDraft] = useState<string | null>(null);
  const shown = draft ?? current;
  const invalid = shown !== "" && !isValidValue(def, shown);

  function commit(value: string) {
    setDraft(null);
    onChange(value);
  }

  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between gap-2">
        <label className="text-[11px] text-muted">{def.label}</label>
        <div className="flex items-center gap-1.5">
          {inherited && current !== "" && (
            <span
              title="Значение унаследовано от компьютера или обычного состояния"
              className="rounded bg-surface px-1 py-0.5 text-[10px] text-muted-2"
            >
              наследуется
            </span>
          )}
          {!inherited && current !== "" && (
            <button
              type="button"
              onClick={onReset}
              disabled={disabled}
              title="Сбросить к наследуемому значению"
              className="text-muted hover:text-danger disabled:opacity-40"
            >
              <RotateCcw size={12} />
            </button>
          )}
        </div>
      </div>

      {def.kind === "media" ? (
        <div className="flex items-center gap-1.5">
          {shown ? (
            <>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={`/api/design/media/${shown}/file`}
                alt=""
                className="h-8 w-8 flex-shrink-0 rounded border border-border object-cover"
              />
              <button type="button" onClick={onPickMedia} disabled={disabled}
                className="rounded-md border border-border px-2 py-1 text-[10px] hover:text-accent disabled:opacity-50">
                Заменить
              </button>
              <button type="button" onClick={() => commit("")} disabled={disabled}
                className="text-[10px] text-muted hover:text-danger disabled:opacity-50">
                Убрать
              </button>
            </>
          ) : (
            <button type="button" onClick={onPickMedia} disabled={disabled}
              className="rounded-md border border-border px-2 py-1 text-[10px] hover:text-accent disabled:opacity-50">
              Выбрать из медиатеки
            </button>
          )}
        </div>
      ) : def.kind === "select" ? (
        <select
          value={shown}
          disabled={disabled}
          onChange={(e) => commit(e.target.value)}
          className="w-full rounded-md border border-border bg-surface-2 px-2 py-1.5 text-xs outline-none focus:border-accent disabled:opacity-50"
        >
          <option value="">— не задано —</option>
          {(def.options ?? []).map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
      ) : def.kind === "color" ? (
        <div className="flex items-center gap-1.5">
          <input
            list={`colors-${def.key}`}
            value={shown}
            disabled={disabled}
            placeholder="напр. var(--accent) или #ff9e2c"
            onChange={(e) => setDraft(e.target.value)}
            onBlur={(e) => commit(e.target.value)}
            className={clsx(
              "min-w-0 flex-1 rounded-md border bg-surface-2 px-2 py-1.5 text-xs outline-none disabled:opacity-50",
              invalid ? "border-danger" : "border-border focus:border-accent"
            )}
          />
          <datalist id={`colors-${def.key}`}>
            {THEME_COLOR_SUGGESTIONS.map((c) => (
              <option key={c} value={c} />
            ))}
          </datalist>
          <span
            aria-hidden="true"
            className="h-7 w-7 flex-shrink-0 rounded border border-border"
            style={{ background: invalid || shown === "" ? "transparent" : shown }}
          />
        </div>
      ) : (
        <input
          value={shown}
          disabled={disabled}
          placeholder={def.kind === "length" ? "напр. 12px, 1.5rem, 50%, auto" : "напр. 1.4"}
          onChange={(e) => setDraft(e.target.value)}
          onBlur={(e) => commit(e.target.value)}
          className={clsx(
            "w-full rounded-md border bg-surface-2 px-2 py-1.5 text-xs outline-none disabled:opacity-50",
            invalid ? "border-danger" : "border-border focus:border-accent"
          )}
        />
      )}

      {invalid && <p className="text-[10px] text-danger">Значение не распознано — оно не будет применено.</p>}
      {def.hint && !invalid && <p className="text-[10px] text-muted-2">{def.hint}</p>}
    </div>
  );
}

export default function PropertyPanel({
  elementId,
  elementLabel,
  scopeLabel,
  values,
  breakpoint,
  state,
  onChange,
  onResetProp,
  locked,
  onPickMedia,
}: Props) {
  const [openGroups, setOpenGroups] = useState<Set<PropertyGroupKey>>(new Set(["text", "colors", "spacing"]));

  const byGroup = useMemo(() => {
    const map = new Map<PropertyGroupKey, PropertyDef[]>();
    for (const def of PROPERTIES) {
      // В состоянии наведения показываем только те свойства, которые в нём
      // имеют смысл, иначе панель вводит в заблуждение.
      if (state !== "normal" && !def.stateful) continue;
      const list = map.get(def.group) ?? [];
      list.push(def);
      map.set(def.group, list);
    }
    return map;
  }, [state]);

  const setCount = useMemo(() => {
    const counts = new Map<PropertyGroupKey, number>();
    for (const def of PROPERTIES) {
      const own = values?.[def.key]?.[breakpoint]?.[state];
      if (typeof own === "string" && own !== "") {
        counts.set(def.group, (counts.get(def.group) ?? 0) + 1);
      }
    }
    return counts;
  }, [values, breakpoint, state]);

  function toggle(group: PropertyGroupKey) {
    setOpenGroups((prev) => {
      const next = new Set(prev);
      if (next.has(group)) next.delete(group);
      else next.add(group);
      return next;
    });
  }

  return (
    <div className="flex h-full flex-col">
      <div className="border-b border-border p-3">
        <p className="truncate text-sm font-semibold text-foreground">{elementLabel}</p>
        <p className="mt-0.5 truncate font-mono text-[10px] text-muted-2">{elementId}</p>
        <p className="mt-1.5 rounded bg-surface-2 px-2 py-1 text-[11px] text-muted">{scopeLabel}</p>
        {locked && (
          <p className="mt-1.5 rounded bg-surface-2 px-2 py-1 text-[11px] text-danger">
            Элемент заблокирован от изменений.
          </p>
        )}
      </div>

      <div className="scroll-slim min-h-0 flex-1 overflow-y-auto">
        {PROPERTY_GROUPS.map((group) => {
          const defs = byGroup.get(group.key);
          if (!defs || defs.length === 0) return null;
          const open = openGroups.has(group.key);
          const count = setCount.get(group.key) ?? 0;
          return (
            <div key={group.key} className="border-b border-border">
              <button
                type="button"
                onClick={() => toggle(group.key)}
                className="flex w-full items-center justify-between gap-2 px-3 py-2.5 text-left text-xs font-medium hover:bg-surface-2"
              >
                <span className="flex items-center gap-2">
                  <ChevronDown
                    size={13}
                    className={clsx("transition-transform text-muted", !open && "-rotate-90")}
                  />
                  {group.label}
                </span>
                {count > 0 && (
                  <span className="rounded-full bg-accent-soft px-1.5 py-0.5 text-[10px] text-accent">{count}</span>
                )}
              </button>
              {open && (
                <div className="space-y-3 px-3 pb-3">
                  {defs.map((def) => {
                    const { value, inherited } = readValue(values, def.key, breakpoint, state);
                    return (
                      <Field
                        key={def.key}
                        def={def}
                        current={value}
                        inherited={inherited}
                        disabled={locked}
                        onChange={(v) => onChange(def.key, v)}
                        onReset={() => onResetProp(def.key)}
                        onPickMedia={onPickMedia ? () => onPickMedia(def.key) : undefined}
                      />
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
