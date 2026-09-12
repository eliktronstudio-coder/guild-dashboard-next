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
export type StateKey = "normal" | "hover" | "active" | "focus" | "disabled";

export const STATES: { key: StateKey; label: string; suffix: string }[] = [
  { key: "normal", label: "Обычное", suffix: "" },
  { key: "hover", label: "Наведение", suffix: ":hover" },
  { key: "active", label: "Нажатие", suffix: ":active" },
  { key: "focus", label: "Фокус", suffix: ":focus-visible" },
  { key: "disabled", label: "Отключено", suffix: ":disabled" },
];

/** Тема, к которой относится значение токена. */
export type ThemeMode = "dark" | "light";

export const THEME_MODES: { key: ThemeMode; label: string }[] = [
  { key: "dark", label: "Тёмная" },
  { key: "light", label: "Светлая" },
];

/**
 * Значения одного элемента: свойство -> брейкпоинт -> состояние -> значение.
 * Пустая строка и undefined означают «не задано» — тогда действует то, что
 * задано в коде страницы (исходное оформление).
 */
export type ElementValues = Record<string, Partial<Record<Breakpoint, Partial<Record<StateKey, string>>>>>;

/** Тип блока, который можно добавить на страницу. */
export type BlockType =
  | "container"
  | "section"
  | "grid"
  | "heading"
  | "text"
  | "image"
  | "button"
  | "divider"
  | "spacer";

/**
 * Блок, добавленный администратором. Собственная структура страницы — дерево
 * таких блоков; рукописные элементы страницы блоками не являются и остаются
 * на своих местах.
 */
export type DesignBlock = {
  /** Устойчивый идентификатор: не меняется при перестановке и правке текста. */
  id: string;
  type: BlockType;
  /** Понятное имя в дереве; пусто — берётся имя типа. */
  name?: string;
  /** Текст для heading/text/button. */
  text?: string;
  /** Ссылка для button: маршрут сайта или безопасный внешний адрес. */
  href?: string;
  /** id медиафайла для image. */
  mediaId?: string;
  /** Замещающий текст для image. */
  alt?: string;
  /** Скрыть на конкретных устройствах. */
  hiddenOn?: Breakpoint[];
  /** Полностью скрыт (но сохранён). */
  hidden?: boolean;
  /** Заблокирован от случайных правок. */
  locked?: boolean;
  children?: DesignBlock[];
};

/** Куда на странице вставляются добавленные блоки. */
export type SlotKey = "top" | "bottom";

export const SLOTS: { key: SlotKey; label: string }[] = [
  { key: "top", label: "Над содержимым страницы" },
  { key: "bottom", label: "Под содержимым страницы" },
];

/**
 * Элемент раскладки страницы.
 *
 * Раскладка — единый упорядоченный список: рукописные секции страницы и
 * добавленные администратором блоки лежат в нём вперемешку. Это и даёт
 * перестановку существующих панелей и вставку своих блоков между ними.
 *
 * Сами секции остаются обычными React-компонентами со своей загрузкой
 * данных: конфиг решает только порядок и видимость, а не как они устроены.
 */
export type LayoutEntry =
  | { kind: "section"; id: string; hidden?: boolean; hiddenOn?: Breakpoint[] }
  | { kind: "block"; id: string };

/** Конфиг одной страницы. */
export type PageConfig = {
  /** Версия формата — читается при миграции сохранённых конфигов. */
  schemaVersion: number;
  elements: Record<string, ElementValues>;
  /**
   * Переопределения токенов темы (--accent и т.п.) по темам. Имеют смысл
   * только в конфиге общих элементов: пишутся в :root и :root[data-theme].
   */
  tokens?: Partial<Record<ThemeMode, Record<string, string>>>;
  /** Переопределения статических подписей: id текста -> новая строка. */
  texts?: Record<string, string>;
  /** Добавленные блоки по слотам. */
  blocks?: Partial<Record<SlotKey, DesignBlock[]>>;
  /**
   * Порядок и видимость секций страницы вперемешку с добавленными блоками.
   * Пусто — действует порядок из кода страницы.
   */
  layout?: LayoutEntry[];
  /** Заблокированные от правки элементы реестра. */
  locks?: string[];
};

export const CURRENT_SCHEMA_VERSION = 3;

export function emptyConfig(): PageConfig {
  return {
    schemaVersion: CURRENT_SCHEMA_VERSION,
    elements: {},
    tokens: { dark: {}, light: {} },
    texts: {},
    blocks: { top: [], bottom: [] },
    layout: [],
    locks: [],
  };
}

/**
 * Сводит сохранённую раскладку с актуальным списком секций страницы.
 *
 * Секции, которых больше нет в коде, выбрасываются; новые добавляются в
 * конец. Без этого добавление панели в код ломало бы страницу у всех, кто
 * уже настроил порядок, — а удаление панели оставляло бы дырку в раскладке.
 */
export function reconcileLayout(
  saved: LayoutEntry[] | undefined,
  sectionIds: string[],
  blockIds: string[]
): LayoutEntry[] {
  const knownSections = new Set(sectionIds);
  const knownBlocks = new Set(blockIds);
  const seen = new Set<string>();
  const result: LayoutEntry[] = [];

  for (const entry of saved ?? []) {
    if (!entry || typeof entry !== "object") continue;
    if (entry.kind === "section") {
      if (!knownSections.has(entry.id) || seen.has(`s:${entry.id}`)) continue;
      seen.add(`s:${entry.id}`);
      result.push(entry);
    } else if (entry.kind === "block") {
      if (!knownBlocks.has(entry.id) || seen.has(`b:${entry.id}`)) continue;
      seen.add(`b:${entry.id}`);
      result.push(entry);
    }
  }

  for (const id of sectionIds) {
    if (!seen.has(`s:${id}`)) result.push({ kind: "section", id });
  }
  for (const id of blockIds) {
    if (!seen.has(`b:${id}`)) result.push({ kind: "block", id });
  }

  return result;
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

/** Обходит дерево блоков сверху вниз. */
export function walkBlocks(
  blocks: DesignBlock[],
  visit: (block: DesignBlock, parent: DesignBlock | null, depth: number) => void,
  parent: DesignBlock | null = null,
  depth = 0
) {
  for (const block of blocks) {
    visit(block, parent, depth);
    if (block.children?.length) walkBlocks(block.children, visit, block, depth + 1);
  }
}

/** Какие типы блоков могут содержать вложенные. */
export const CONTAINER_TYPES: BlockType[] = ["container", "section", "grid"];

export function canContain(type: BlockType): boolean {
  return CONTAINER_TYPES.includes(type);
}
