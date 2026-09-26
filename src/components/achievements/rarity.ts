import type { Rarity } from "@/lib/achievements/tiers";

/**
 * Оформление по редкости: металлическая рамка и сдержанное свечение.
 *
 * Свечение задаётся тенью, а не анимацией: карточек на экране десятки, и
 * постоянное движение мешало бы читать. Всё через токены темы, поэтому
 * светлая тема работает без отдельной ветки.
 */
export type RarityStyle = {
  /** Цвет рамки и иконки. */
  border: string;
  text: string;
  /** Мягкое свечение вокруг иконки. */
  glow: string;
  label: string;
};

const STYLES: Record<Rarity, RarityStyle> = {
  Обычная: {
    border: "border-zinc-500/50",
    text: "text-zinc-400",
    glow: "shadow-[0_0_10px_-2px_rgba(161,161,170,0.45)]",
    label: "Обычная",
  },
  Необычная: {
    border: "border-emerald-500/50",
    text: "text-emerald-400",
    glow: "shadow-[0_0_10px_-2px_rgba(52,211,153,0.5)]",
    label: "Необычная",
  },
  Редкая: {
    border: "border-sky-500/50",
    text: "text-sky-400",
    glow: "shadow-[0_0_10px_-2px_rgba(56,189,248,0.5)]",
    label: "Редкая",
  },
  Эпическая: {
    border: "border-violet-500/55",
    text: "text-violet-400",
    glow: "shadow-[0_0_12px_-2px_rgba(167,139,250,0.55)]",
    label: "Эпическая",
  },
  Легендарная: {
    border: "border-amber-500/60",
    text: "text-amber-400",
    glow: "shadow-[0_0_14px_-2px_rgba(251,191,36,0.6)]",
    label: "Легендарная",
  },
  Мифическая: {
    border: "border-rose-500/60",
    text: "text-rose-400",
    glow: "shadow-[0_0_16px_-2px_rgba(251,113,133,0.6)]",
    label: "Мифическая",
  },
};

/** Ещё не начатая цепочка — приглушённая, но читаемая. */
export const LOCKED_STYLE: RarityStyle = {
  border: "border-border",
  text: "text-muted",
  glow: "",
  label: "Не начато",
};

export function rarityStyle(rarity: Rarity | null): RarityStyle {
  return rarity ? STYLES[rarity] : LOCKED_STYLE;
}
