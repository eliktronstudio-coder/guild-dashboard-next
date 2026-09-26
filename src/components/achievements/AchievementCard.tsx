"use client";

import clsx from "clsx";
import AchievementIcon from "./AchievementIcon";
import { rarityStyle } from "./rarity";
import { DEFAULT_TIERS } from "@/lib/achievements/tiers";
import { pluralizeUnit } from "@/lib/achievements/units";
import type { AchievementState } from "@/lib/achievements/progress";

const numberFmt = new Intl.NumberFormat("ru-RU");

/**
 * Одна карточка — вся цепочка целиком, а не отдельная ступень.
 *
 * Базовый размер 300×100, но высота может вырасти: при крупном системном
 * шрифте текст обязан переноситься, а не обрезаться. Ширина на узком экране
 * сжимается до колонки — горизонтальной прокрутки быть не должно.
 */
export default function AchievementCard({
  item,
  onOpen,
}: {
  item: AchievementState;
  onOpen: (item: AchievementState) => void;
}) {
  const p = item.progress;
  const noSource = item.source === "pending";
  const current = p && p.level > 0 ? DEFAULT_TIERS[p.level - 1] : null;
  const style = rarityStyle(current?.rarity ?? null);
  const started = !!p && p.value > 0;

  return (
    <button
      type="button"
      onClick={() => onOpen(item)}
      aria-label={`${item.title}. ${item.condition}. Подробности`}
      className={clsx(
        "group flex w-full min-h-[100px] items-center gap-3 rounded-lg border bg-surface p-3 text-left transition-colors",
        "hover:border-border-strong hover:bg-surface-hover",
        "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent",
        style.border,
        // Неполученные приглушаем, но не до нечитаемости.
        !started && "opacity-70"
      )}
    >
      <span
        className={clsx(
          "flex h-[54px] w-[54px] flex-shrink-0 items-center justify-center rounded-md border bg-surface-2",
          style.border,
          style.text,
          started && !noSource && style.glow
        )}
      >
        <AchievementIcon name={item.icon} size={32} />
      </span>

      <span className="min-w-0 flex-1">
        <span className="flex items-baseline justify-between gap-2">
          <span className="truncate text-sm font-medium text-foreground">{item.title}</span>
          {p && p.level > 0 && (
            <span className={clsx("flex-shrink-0 font-mono text-xs font-semibold", style.text)}>
              {DEFAULT_TIERS[p.level - 1].roman}
            </span>
          )}
        </span>

        <span className="mt-0.5 block line-clamp-2 text-[11px] leading-snug text-muted">{item.condition}</span>

        {noSource ? (
          <span className="mt-1.5 block text-[11px] text-amber-500">Источник данных не настроен</span>
        ) : p?.maxed ? (
          <span className={clsx("mt-1.5 block text-[11px] font-medium", style.text)}>Максимальный уровень</span>
        ) : (
          <>
            <span className="mt-1.5 flex items-baseline justify-between gap-2 text-[11px] tabular-nums text-muted">
              <span>
                {numberFmt.format(p?.value ?? 0)}/{numberFmt.format(p?.next?.threshold ?? 0)}{" "}
                {pluralizeUnit(p?.next?.threshold ?? 0, item.unit)}
              </span>
              <span className={style.text}>{DEFAULT_TIERS[p?.level ?? 0]?.roman ?? ""}</span>
            </span>
            <span className="mt-1 block h-1 w-full overflow-hidden rounded-full bg-surface-2">
              <span
                className={clsx("block h-full rounded-full bg-current", style.text)}
                style={{ width: `${Math.round((p?.ratio ?? 0) * 100)}%` }}
              />
            </span>
          </>
        )}
      </span>
    </button>
  );
}
