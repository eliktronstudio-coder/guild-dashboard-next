"use client";

import { useMemo, useState } from "react";
import clsx from "clsx";
import { Search } from "lucide-react";
import Modal from "@/components/Modal";
import EmptyState from "@/components/EmptyState";
import AchievementCard from "./AchievementCard";
import AchievementIcon from "./AchievementIcon";
import { rarityStyle } from "./rarity";
import { CATEGORIES } from "@/lib/achievements/catalog";
import { DEFAULT_TIERS } from "@/lib/achievements/tiers";
import { pluralizeUnit } from "@/lib/achievements/units";
import type { AchievementState } from "@/lib/achievements/progress";

const numberFmt = new Intl.NumberFormat("ru-RU");

const STATES = ["Все", "Полученные", "В процессе", "Не начаты"] as const;
type StateFilter = (typeof STATES)[number];

/** Состояние цепочки для фильтра. */
function stateOf(item: AchievementState): Exclude<StateFilter, "Все"> {
  const p = item.progress;
  if (!p || p.value === 0) return "Не начаты";
  return p.level > 0 ? "Полученные" : "В процессе";
}

/**
 * Насколько цепочка близка к следующей ступени, 0..1. Чем больше, тем ближе.
 * Цепочки без источника и закрытые целиком уходят в конец такой сортировки —
 * им «ближе» быть не к чему.
 */
function closeness(item: AchievementState): number {
  const p = item.progress;
  if (!p || p.maxed) return -1;
  return p.ratio;
}

export default function AchievementsBrowser({
  items,
  emptyHint,
}: {
  items: AchievementState[];
  emptyHint?: string;
}) {
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState<string>("Все");
  const [state, setState] = useState<StateFilter>("Все");
  const [byCloseness, setByCloseness] = useState(false);
  const [opened, setOpened] = useState<AchievementState | null>(null);

  const shown = useMemo(() => {
    const q = query.trim().toLowerCase();
    const list = items.filter((i) => {
      // Секретные прячем, пока не взята первая ступень.
      if (i.secret && (i.progress?.level ?? 0) === 0) return false;
      if (category !== "Все" && i.category !== category) return false;
      if (state !== "Все" && stateOf(i) !== state) return false;
      if (q && !`${i.title} ${i.condition}`.toLowerCase().includes(q)) return false;
      return true;
    });

    return byCloseness ? [...list].sort((a, b) => closeness(b) - closeness(a)) : list;
  }, [items, query, category, state, byCloseness]);

  const openedStyle = opened?.progress?.level
    ? rarityStyle(DEFAULT_TIERS[opened.progress.level - 1].rarity)
    : rarityStyle(null);

  return (
    <div className="space-y-3">
      {/* ——— Поиск и фильтры ——— */}
      <div className="space-y-2">
        <div className="relative">
          <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Поиск по названию или условию…"
            aria-label="Поиск достижений"
            className="w-full rounded-md border border-border bg-surface-2 py-1.5 pl-8 pr-3 text-sm"
          />
        </div>

        <div className="flex flex-wrap gap-1.5" role="group" aria-label="Категории">
          {["Все", ...CATEGORIES].map((c) => (
            <button
              key={c}
              type="button"
              onClick={() => setCategory(c)}
              aria-pressed={category === c}
              className={clsx(
                "rounded-md border px-2.5 py-1 text-xs transition-colors",
                "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-accent",
                category === c ? "border-accent bg-accent/10 text-foreground" : "border-border text-muted hover:bg-surface-2"
              )}
            >
              {c}
            </button>
          ))}
        </div>

        <div className="flex flex-wrap items-center gap-1.5">
          <div className="flex flex-wrap gap-1.5" role="group" aria-label="Состояние">
            {STATES.map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => setState(s)}
                aria-pressed={state === s}
                className={clsx(
                  "rounded-md border px-2.5 py-1 text-xs transition-colors",
                  "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-accent",
                  state === s ? "border-accent bg-accent/10 text-foreground" : "border-border text-muted hover:bg-surface-2"
                )}
              >
                {s}
              </button>
            ))}
          </div>
          <label className="ml-auto flex items-center gap-1.5 text-xs text-muted">
            <input type="checkbox" checked={byCloseness} onChange={(e) => setByCloseness(e.target.checked)} />
            Сначала близкие к ступени
          </label>
        </div>
      </div>

      {/* ——— Сетка карточек ——— */}
      {shown.length === 0 ? (
        <div className="rounded-lg border border-border bg-surface">
          <EmptyState title="Ничего не найдено" hint={emptyHint ?? "Измените поиск или фильтры."} />
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {shown.map((i) => (
            <AchievementCard key={i.key} item={i} onOpen={setOpened} />
          ))}
        </div>
      )}

      {/* ——— Подробности ——— */}
      <Modal open={!!opened} onClose={() => setOpened(null)} title={opened?.title ?? ""}>
        {opened && (
          <div className="space-y-4">
            <div className="flex items-start gap-3">
              <span
                className={clsx(
                  "flex h-14 w-14 flex-shrink-0 items-center justify-center rounded-md border bg-surface-2",
                  openedStyle.border,
                  openedStyle.text
                )}
              >
                <AchievementIcon name={opened.icon} size={34} />
              </span>
              <div className="min-w-0">
                <p className="text-xs text-muted">{opened.category}</p>
                <p className="text-sm">{opened.condition}</p>
                {opened.note && <p className="mt-1 text-xs text-muted">{opened.note}</p>}
              </div>
            </div>

            {opened.source === "pending" ? (
              <div className="rounded-md border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-xs text-amber-500">
                Источник данных не настроен: это достижение пока не считается. Прогресс появится, когда в формах
                начнут заполнять нужные сведения.
              </div>
            ) : (
              <div className="rounded-md border border-border bg-surface-2 px-3 py-2 text-sm">
                Набрано:{" "}
                <span className="font-mono tabular-nums">
                  {numberFmt.format(opened.progress?.value ?? 0)} {pluralizeUnit(opened.progress?.value ?? 0, opened.unit)}
                </span>
                {opened.progress?.next && (
                  <>
                    {" · до ступени "}
                    {opened.progress.next.roman}:{" "}
                    <span className="font-mono tabular-nums">
                      {numberFmt.format(opened.progress.remaining ?? 0)}
                    </span>
                  </>
                )}
              </div>
            )}

            <div>
              <p className="mb-1.5 text-xs font-medium text-muted">Все ступени</p>
              <ul className="space-y-1">
                {DEFAULT_TIERS.map((t) => {
                  const earned = (opened.progress?.level ?? 0) >= t.level;
                  const s = rarityStyle(t.rarity);
                  return (
                    <li
                      key={t.level}
                      className={clsx(
                        "flex items-center justify-between gap-2 rounded-md border px-2.5 py-1.5 text-xs",
                        earned ? s.border : "border-border",
                        !earned && "opacity-60"
                      )}
                    >
                      <span className={clsx("font-mono font-semibold", earned ? s.text : "text-muted")}>
                        {t.roman}
                      </span>
                      <span className="flex-1 truncate text-muted">{t.rarity}</span>
                      <span className="font-mono tabular-nums text-muted">
                        {numberFmt.format(t.threshold)} {pluralizeUnit(t.threshold, opened.unit)}
                      </span>
                      <span className={clsx("w-16 text-right font-mono tabular-nums", earned ? s.text : "text-muted")}>
                        {earned ? `+${t.points}` : `${t.points}`}
                      </span>
                    </li>
                  );
                })}
              </ul>
              <p className="mt-1.5 text-[11px] text-muted">
                Пороги накопительные: указано, сколько нужно набрать всего, а не сверх прошлой ступени.
              </p>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
