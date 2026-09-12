/**
 * Реестр редактируемых страниц, элементов и статических подписей.
 *
 * Это единственный источник правды о том, что можно редактировать. Компилятор
 * принимает только идентификаторы отсюда, поэтому конфиг не может сослаться
 * на произвольный селектор и задеть чужую страницу.
 *
 * Элемент описывается одним из двух способов:
 *  - по атрибуту: id совпадает с data-design-el в разметке (устойчиво к
 *    перестановке и правке текста);
 *  - по фиксированному селектору (поле selector) — для семантических групп
 *    вроде кнопок и полей ввода, которые встречаются повсеместно. Селектор
 *    задаётся здесь, в коде, а не приходит от пользователя.
 */

import type { PropertyGroupKey } from "./properties";

export const SHARED_KEY = "__shared__";

export type ElementDef = {
  /** Устойчивый идентификатор; для атрибутных элементов совпадает с data-design-el. */
  id: string;
  label: string;
  /** id родителя внутри той же страницы — для дерева элементов. */
  parent?: string;
  /** Фиксированный селектор вместо атрибута. */
  selector?: string;
  /** Какие группы свойств показывать. Пусто — все. */
  groups?: PropertyGroupKey[];
  /** Пояснение для администратора. */
  note?: string;
};

export type TextDef = {
  id: string;
  label: string;
  /** Текст в коде — показывается как исходное значение. */
  fallback: string;
  note?: string;
};

/**
 * Секция страницы — рукописный блок содержимого, который можно переставить,
 * скрыть или убрать из раскладки. Сам компонент остаётся в коде: конфиг
 * задаёт только порядок и видимость.
 */
export type SectionDef = {
  id: string;
  label: string;
  note?: string;
};

export type PageDef = {
  key: string;
  label: string;
  /** Раздел меню, к которому относится страница. */
  section: string;
  /** Маршрут для предпросмотра. */
  route: string;
  /** Переставляемые секции страницы; пусто — страница не разбита на секции. */
  sections?: SectionDef[];
  /** Страница — шаблон: предпросмотр требует выбрать пример записи. */
  template?: {
    sampleKind: "activity" | "player";
    buildRoute: (id: string) => string;
    note: string;
  };
  elements: ElementDef[];
  texts?: TextDef[];
};

/** Общие элементы и тема — действуют на весь сайт. */
export const SHARED_ELEMENTS: ElementDef[] = [
  // Каркас
  { id: "shared.sidebar", label: "Боковое меню" },
  { id: "shared.sidebarSection", label: "Заголовок раздела меню", parent: "shared.sidebar" },
  { id: "shared.sidebarItem", label: "Пункт меню", parent: "shared.sidebar" },
  { id: "shared.header", label: "Шапка" },
  { id: "shared.headerTitle", label: "Заголовок страницы в шапке", parent: "shared.header" },
  { id: "shared.main", label: "Область контента" },
  { id: "shared.footer", label: "Подвал" },
  { id: "shared.bottomNav", label: "Нижнее меню (телефон)" },

  // Контейнеры и карточки
  { id: "shared.panel", label: "Панель (карточка-контейнер)", note: "Общий вид всех панелей сайта." },
  { id: "shared.sectionTitle", label: "Заголовок панели", parent: "shared.panel" },
  { id: "shared.statCard", label: "Карточка показателя" },
  { id: "shared.activityRow", label: "Строка активности" },
  { id: "shared.rankRow", label: "Строка рейтинга" },
  { id: "shared.emptyState", label: "Блок «нет данных»" },

  // Таблицы
  { id: "shared.table", label: "Таблица" },
  { id: "shared.tableHeadCell", label: "Заголовок колонки", parent: "shared.table", selector: "[data-design-el=\"shared.table\"] thead th" },
  { id: "shared.tableRow", label: "Строка таблицы", parent: "shared.table", selector: "[data-design-el=\"shared.table\"] tbody tr" },
  { id: "shared.tableCell", label: "Ячейка таблицы", parent: "shared.table", selector: "[data-design-el=\"shared.table\"] tbody td" },

  // Формы и управление
  {
    id: "shared.button",
    label: "Кнопки",
    selector: "main button:not([data-design-el]), main a[data-xd-button]",
    note: "Все кнопки в области контента.",
  },
  { id: "shared.link", label: "Ссылки в тексте", selector: "main a:not([data-design-el]):not([data-xd-button])" },
  {
    id: "shared.input",
    label: "Поля ввода",
    selector: "main input:not([type=\"checkbox\"]):not([type=\"radio\"]), main textarea",
  },
  { id: "shared.select", label: "Выпадающие списки", selector: "main select" },
  { id: "shared.checkbox", label: "Флажки", selector: "main input[type=\"checkbox\"]" },
  { id: "shared.label", label: "Подписи полей", selector: "main label" },

  // Индикаторы и всплывающие окна
  { id: "shared.badge", label: "Бейдж статуса" },
  { id: "shared.modal", label: "Модальное окно" },
  { id: "shared.modalOverlay", label: "Затемнение за окном", parent: "shared.modal" },
  { id: "shared.drawer", label: "Выезжающая панель" },

  // Графики
  { id: "shared.chart", label: "Область графика" },
  { id: "shared.chartGrid", label: "Сетка графика", parent: "shared.chart", selector: "[data-design-el=\"shared.chart\"] .recharts-cartesian-grid line" },
  // Подпись оси — это <text class="recharts-cartesian-axis-tick-value">;
  // группа .recharts-cartesian-axis-tick текст не содержит.
  { id: "shared.chartAxis", label: "Подписи осей", parent: "shared.chart", selector: "[data-design-el=\"shared.chart\"] .recharts-cartesian-axis-tick-value" },
  { id: "shared.chartAxisLine", label: "Линии осей", parent: "shared.chart", selector: "[data-design-el=\"shared.chart\"] .recharts-cartesian-axis-line" },
  { id: "shared.chartLegend", label: "Легенда графика", parent: "shared.chart", selector: "[data-design-el=\"shared.chart\"] .recharts-legend-wrapper" },
  { id: "shared.chartTooltip", label: "Подсказка графика", parent: "shared.chart", selector: ".recharts-tooltip-wrapper" },
];

/** Общие подписи каркаса. */
export const SHARED_TEXTS: TextDef[] = [
  { id: "shared.footerText", label: "Текст подвала", fallback: "v0.1.0" },
  { id: "shared.loginButton", label: "Кнопка входа в меню", fallback: "Войти" },
  { id: "shared.logoutButton", label: "Кнопка выхода в меню", fallback: "Выйти" },
  { id: "shared.navSectionOverview", label: "Раздел меню «Обзор»", fallback: "Обзор" },
  { id: "shared.navSectionEconomy", label: "Раздел меню «Экономика»", fallback: "Экономика" },
  { id: "shared.navSectionTools", label: "Раздел меню «Инструменты»", fallback: "Инструменты" },
  { id: "shared.navSectionAdmin", label: "Раздел меню «Администрирование»", fallback: "Администрирование" },
];

/** Токены темы: редактируются только в «Общих элементах», пишутся в :root. */
export const THEME_TOKENS: { key: string; label: string; group: "Палитра" | "Поверхности" | "Текст" }[] = [
  { key: "accent", label: "Акцент", group: "Палитра" },
  { key: "accent-bright", label: "Акцент яркий", group: "Палитра" },
  { key: "accent-dim", label: "Акцент приглушённый", group: "Палитра" },
  { key: "accent-soft", label: "Акцент фоновый", group: "Палитра" },
  { key: "danger", label: "Опасность", group: "Палитра" },
  { key: "success", label: "Успех", group: "Палитра" },
  { key: "info", label: "Информация", group: "Палитра" },
  { key: "jade", label: "Нефрит", group: "Палитра" },
  { key: "violet", label: "Фиолетовый", group: "Палитра" },
  { key: "ember", label: "Угольный", group: "Палитра" },
  { key: "background", label: "Фон страницы", group: "Поверхности" },
  { key: "surface", label: "Поверхность", group: "Поверхности" },
  { key: "surface-2", label: "Поверхность 2", group: "Поверхности" },
  { key: "surface-hover", label: "Поверхность при наведении", group: "Поверхности" },
  { key: "bg-sidebar", label: "Фон бокового меню", group: "Поверхности" },
  { key: "border", label: "Граница", group: "Поверхности" },
  { key: "border-strong", label: "Граница выделенная", group: "Поверхности" },
  { key: "foreground", label: "Основной текст", group: "Текст" },
  { key: "muted", label: "Приглушённый текст", group: "Текст" },
  { key: "muted-2", label: "Очень приглушённый текст", group: "Текст" },
];

/**
 * Страница без собственных размеченных элементов: редактируется через общие
 * элементы, ограниченные областью этой страницы (см. compileConfig — правило
 * получает префикс [data-design-page="key"]).
 */
function simplePage(key: string, label: string, section: string, route: string, texts?: TextDef[]): PageDef {
  return { key, label, section, route, elements: [], texts };
}

export const PAGES: PageDef[] = [
  {
    key: "home",
    label: "Главная",
    section: "Обзор",
    route: "/",
    sections: [
      { id: "home.myAttendance", label: "Моя посещаемость" },
      { id: "home.myChart", label: "Мой график посещаемости" },
      { id: "home.schedule", label: "До активностей" },
      { id: "home.recent", label: "Последние активности" },
      { id: "home.leadersPrime", label: "Посещаемость: Прайм" },
      { id: "home.leadersMiniRb", label: "Посещаемость: Мини-РБ" },
    ],
    elements: [
      { id: "home.root", label: "Вся страница" },
      { id: "home.myAttendance", label: "Панель «Моя посещаемость»", parent: "home.root" },
      { id: "home.myAttendanceStat", label: "Плитка процента", parent: "home.myAttendance" },
      { id: "home.myChart", label: "Панель «Мой график посещаемости»", parent: "home.root" },
      { id: "home.schedule", label: "Панель «До активностей»", parent: "home.root" },
      { id: "home.recent", label: "Панель «Последние активности»", parent: "home.root" },
      { id: "home.leadersPrime", label: "Панель «Посещаемость: Прайм»", parent: "home.root" },
      { id: "home.leadersMiniRb", label: "Панель «Посещаемость: Мини-РБ»", parent: "home.root" },
    ],
    texts: [
      { id: "home.titleMyAttendance", label: "Заголовок «Моя посещаемость»", fallback: "Моя посещаемость" },
      { id: "home.titleMyChart", label: "Заголовок «Мой график посещаемости»", fallback: "Мой график посещаемости" },
      { id: "home.titleSchedule", label: "Заголовок «До активностей»", fallback: "До активностей" },
      { id: "home.titleRecent", label: "Заголовок «Последние активности»", fallback: "Последние активности" },
      { id: "home.titlePrime", label: "Заголовок «Посещаемость: Прайм»", fallback: "Посещаемость: Прайм" },
      { id: "home.titleMiniRb", label: "Заголовок «Посещаемость: Мини-РБ»", fallback: "Посещаемость: Мини-РБ" },
      { id: "home.statTotal", label: "Подпись «Общая»", fallback: "Общая" },
      { id: "home.statPrime", label: "Подпись «Прайм»", fallback: "Прайм" },
      { id: "home.statMiniRb", label: "Подпись «Мини-РБ»", fallback: "Мини-РБ" },
      { id: "home.linkProfile", label: "Ссылка «Профиль»", fallback: "Профиль" },
      { id: "home.linkAll", label: "Ссылка «Все»", fallback: "Все" },
    ],
  },
  {
    key: "dashboard",
    label: "Статистика",
    section: "Обзор",
    route: "/dashboard",
    sections: [
      { id: "dashboard.kpi", label: "Показатели и баннер" },
      {
        id: "dashboard.panels",
        label: "Настраиваемые панели",
        note: "Внутренний порядок панелей пользователь меняет сам на странице.",
      },
    ],
    elements: [
      { id: "dashboard.root", label: "Вся страница" },
      { id: "dashboard.kpiGrid", label: "Сетка показателей", parent: "dashboard.root" },
      { id: "dashboard.hero", label: "Фоновое изображение сверху", parent: "dashboard.root" },
    ],
  },
  simplePage("activities", "Активность", "Обзор", "/activities"),
  simplePage("players", "Состав", "Обзор", "/players"),
  simplePage("profile", "Мой профиль", "Обзор", "/profile"),
  simplePage("treasury", "Казна", "Экономика", "/treasury"),
  simplePage("payments", "Выплаты", "Экономика", "/payments"),
  simplePage("calculator", "Калькуляторы", "Инструменты", "/calculator"),
  {
    key: "archeage",
    label: "ArcheAge",
    section: "Инструменты",
    route: "/archeage",
    sections: [
      { id: "archeage.heading", label: "Заголовок страницы" },
      { id: "archeage.gear", label: "Калькулятор ранга экипировки" },
      { id: "archeage.packs", label: "Блок про калькулятор паков" },
    ],
    elements: [],
    texts: [
    { id: "archeage.title", label: "Заголовок страницы", fallback: "ArcheAge" },
    {
      id: "archeage.subtitle",
      label: "Подзаголовок",
      fallback: "Полезные инструменты и справочная информация по игре.",
    },
    ],
  },
  simplePage("users", "Пользователи", "Администрирование", "/users"),
  simplePage("dropCatalog", "Реестр дропа", "Администрирование", "/drop-catalog"),
  simplePage("activityBanners", "Баннеры активностей", "Администрирование", "/activity-banners"),
  simplePage("rbPurchase", "Расчёт покупки РБ", "Администрирование", "/rb-purchase", [
    { id: "rbPurchase.title", label: "Заголовок страницы", fallback: "Расчёт покупки РБ" },
    {
      id: "rbPurchase.subtitle",
      label: "Описание под заголовком",
      fallback:
        "Выберите участников и укажите объём купленного РБ опыта — он разделится между выбранными пропорционально их посещаемости Мини-РБ (с учётом индивидуального коэффициента, как в расчёте зарплаты). В списке только игроки с посещаемостью Мини-РБ от 20%.",
    },
  ]),
  simplePage("drops", "Дроп", "Администрирование", "/drops"),
  {
    key: "activityDetail",
    label: "Активность — карточка",
    section: "Шаблоны",
    route: "/activities",
    template: {
      sampleKind: "activity",
      buildRoute: (id) => `/activities/${id}`,
      note: "Изменения применяются ко всем карточкам активностей.",
    },
    elements: [{ id: "activityDetail.root", label: "Вся страница" }],
  },
  {
    key: "playerDetail",
    label: "Игрок — профиль",
    section: "Шаблоны",
    route: "/players",
    template: {
      sampleKind: "player",
      buildRoute: (id) => `/players/${id}`,
      note: "Изменения применяются ко всем профилям игроков.",
    },
    elements: [{ id: "playerDetail.root", label: "Вся страница" }],
  },
];

export const PAGE_BY_KEY = new Map(PAGES.map((p) => [p.key, p]));

const SELECTOR_BY_ID = new Map<string, string>();
for (const def of SHARED_ELEMENTS) if (def.selector) SELECTOR_BY_ID.set(def.id, def.selector);
for (const page of PAGES) for (const def of page.elements) if (def.selector) SELECTOR_BY_ID.set(def.id, def.selector);

/**
 * Селектор элемента для компилятора. Либо фиксированный из реестра, либо
 * атрибутный. Ничего, что пришло от пользователя, сюда не попадает.
 */
export function selectorForElement(id: string): string {
  const fixed = SELECTOR_BY_ID.get(id);
  if (fixed) return fixed;
  if (id.startsWith("block.")) {
    // Блоки, добавленные администратором, размечаются тем же атрибутом.
    return /^block\.[a-zA-Z0-9_-]+$/.test(id) ? `[data-design-el="${id}"]` : "";
  }
  return /^[a-zA-Z0-9._-]+$/.test(id) ? `[data-design-el="${id}"]` : "";
}

/** Все допустимые id элементов — и страничные, и общие. */
export function allowedElementIds(pageKey: string): Set<string> {
  const ids = new Set<string>(SHARED_ELEMENTS.map((e) => e.id));
  if (pageKey === SHARED_KEY) return ids;
  const page = PAGE_BY_KEY.get(pageKey);
  for (const e of page?.elements ?? []) ids.add(e.id);
  return ids;
}

/** Допустимые id статических подписей. */
export function allowedTextIds(pageKey: string): Set<string> {
  if (pageKey === SHARED_KEY) return new Set(SHARED_TEXTS.map((t) => t.id));
  const page = PAGE_BY_KEY.get(pageKey);
  return new Set((page?.texts ?? []).map((t) => t.id));
}

/** Секции страницы; для общих настроек их нет. */
export function sectionsFor(pageKey: string): SectionDef[] {
  if (pageKey === SHARED_KEY) return [];
  return PAGE_BY_KEY.get(pageKey)?.sections ?? [];
}

export function textsFor(pageKey: string): TextDef[] {
  if (pageKey === SHARED_KEY) return SHARED_TEXTS;
  return PAGE_BY_KEY.get(pageKey)?.texts ?? [];
}

export function isKnownPageKey(key: string): boolean {
  return key === SHARED_KEY || PAGE_BY_KEY.has(key);
}

/** Маршрут -> ключ страницы; нужен, чтобы отдать нужный CSS при рендере сайта. */
export function pageKeyForPathname(pathname: string): string | null {
  if (pathname === "/") return "home";
  if (/^\/activities\/[^/]+$/.test(pathname)) return "activityDetail";
  if (/^\/players\/[^/]+$/.test(pathname)) return "playerDetail";
  const direct = PAGES.find((p) => !p.template && p.route !== "/" && pathname === p.route);
  return direct?.key ?? null;
}
