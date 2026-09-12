/**
 * Типы конфигурации оформления.
 *
 * Конфиг страницы — это карта «идентификатор элемента -> значения свойств»,
 * где идентификаторы берутся из реестра (registry.ts), а не из произвольных
 * CSS-селекторов. Благодаря этому перестановка разметки или смена текста не
 * ломает сохранённые настройки, а компилятор стилей не может случайно задеть
 * соседнюю страницу.
 */

/** Ключ устройства. base — значение по умолчанию, остальные переопределяют его. */
export type Breakpoint = "base" | "tablet" | "mobile";

export const BREAKPOINTS: { key: Breakpoint; label: string; maxWidth: number | null }[] = [
  { key: "base", label: "Компьютер", maxWidth: null },
  { key: "tablet", label: "Планшет", maxWidth: 1023 },
  { key: "mobile", label: "Телефон", maxWidth: 767 },
];

/** Медиазапрос для брейкпоинта; для base — null (правило без обёртки). */
export function mediaQueryFor(bp: Breakpoint): string | null {
  const found = BREAKPOINTS.find((b) => b.key === bp);
  if (!found || found.maxWidth === null) return null;
  return `@media (max-width: ${found.maxWidth}px)`;
}

/** Состояние элемента, к которому применяется значение. */
export type StateKey = "normal" | "hover";

export const STATES: { key: StateKey; label: string; suffix: string }[] = [
  { key: "normal", label: "Обычное", suffix: "" },
  { key: "hover", label: "Наведение", suffix: ":hover" },
];

/**
 * Значения одного элемента: свойство -> брейкпоинт -> состояние -> значение.
 * Пустая строка и undefined означают «не задано» — тогда действует то, что
 * задано в коде страницы (исходное оформление).
 */
export type ElementValues = Record<string, Partial<Record<Breakpoint, Partial<Record<StateKey, string>>>>>;

/** Конфиг одной страницы: элемент -> его значения. */
export type PageConfig = {
  /** Версия формата — читается при миграции сохранённых конфигов. */
  schemaVersion: number;
  elements: Record<string, ElementValues>;
  /**
   * Переопределения токенов темы (--accent и т.п.). Имеют смысл только в
   * конфиге общих элементов: пишутся в :root и действуют на весь сайт.
   */
  tokens?: Record<string, string>;
};

export const CURRENT_SCHEMA_VERSION = 1;

export function emptyConfig(): PageConfig {
  return { schemaVersion: CURRENT_SCHEMA_VERSION, elements: {}, tokens: {} };
}

/** Достаёт значение с учётом наследования: состояние -> base-состояние -> base-брейкпоинт. */
export function readValue(
  values: ElementValues | undefined,
  prop: string,
  bp: Breakpoint,
  state: StateKey
): { value: string; inherited: boolean } {
  const byBp = values?.[prop];
  const own = byBp?.[bp]?.[state];
  if (own !== undefined && own !== "") return { value: own, inherited: false };

  if (state !== "normal") {
    const normalSame = byBp?.[bp]?.normal;
    if (normalSame !== undefined && normalSame !== "") return { value: normalSame, inherited: true };
  }
  if (bp !== "base") {
    const base = byBp?.base?.[state] ?? byBp?.base?.normal;
    if (base !== undefined && base !== "") return { value: base, inherited: true };
  }
  return { value: "", inherited: false };
}
