/**
 * Реестр редактируемых страниц и элементов.
 *
 * Это единственный источник правды о том, что можно редактировать. Компилятор
 * стилей принимает только идентификаторы отсюда, поэтому конфиг не может
 * сослаться на произвольный селектор и задеть чужую страницу.
 *
 * Чтобы подключить новый элемент: добавить сюда запись и проставить в разметке
 * атрибут data-design-el с тем же id (см. helpers в ./attr.ts).
 */

import type { PropertyGroupKey } from "./properties";

export const SHARED_KEY = "__shared__";

export type ElementDef = {
  /** Устойчивый идентификатор; совпадает с data-design-el в разметке. */
  id: string;
  label: string;
  /** id родителя внутри той же страницы — для дерева элементов. */
  parent?: string;
  /** Какие группы свойств показывать. Пусто — все. */
  groups?: PropertyGroupKey[];
  /** Пояснение для администратора. */
  note?: string;
};

export type PageDef = {
  key: string;
  label: string;
  /** Раздел меню, к которому относится страница. */
  section: string;
  /** Маршрут для предпросмотра. */
  route: string;
  /** Страница — шаблон: предпросмотр требует выбрать пример записи. */
  template?: {
    /** Откуда брать примеры: используется в API /api/design/samples. */
    sampleKind: "activity" | "player";
    /** Как собрать маршрут из id примера. */
    buildRoute: (id: string) => string;
    note: string;
  };
  elements: ElementDef[];
};

/** Общие элементы и тема — действуют на весь сайт. */
export const SHARED_ELEMENTS: ElementDef[] = [
  { id: "shared.sidebar", label: "Боковое меню" },
  { id: "shared.sidebarSection", label: "Заголовок раздела меню", parent: "shared.sidebar" },
  { id: "shared.sidebarItem", label: "Пункт меню", parent: "shared.sidebar" },
  { id: "shared.header", label: "Шапка" },
  { id: "shared.headerTitle", label: "Заголовок страницы в шапке", parent: "shared.header" },
  { id: "shared.main", label: "Область контента" },
  { id: "shared.footer", label: "Подвал" },
  { id: "shared.bottomNav", label: "Нижнее меню (телефон)" },
  { id: "shared.panel", label: "Панель (карточка-контейнер)", note: "Общий вид всех панелей на сайте." },
  { id: "shared.sectionTitle", label: "Заголовок панели", parent: "shared.panel" },
  { id: "shared.statCard", label: "Карточка показателя" },
  { id: "shared.activityRow", label: "Строка активности" },
  { id: "shared.rankRow", label: "Строка рейтинга" },
];

/** Токены темы: редактируются только в «Общих элементах», пишутся в :root. */
export const THEME_TOKENS: { key: string; label: string; group: "Палитра" | "Поверхности" | "Текст" }[] = [
  { key: "accent", label: "Акцент", group: "Палитра" },
  { key: "accent-bright", label: "Акцент яркий", group: "Палитра" },
  { key: "accent-dim", label: "Акцент приглушённый", group: "Палитра" },
  { key: "danger", label: "Опасность", group: "Палитра" },
  { key: "success", label: "Успех", group: "Палитра" },
  { key: "info", label: "Информация", group: "Палитра" },
  { key: "jade", label: "Нефрит", group: "Палитра" },
  { key: "background", label: "Фон страницы", group: "Поверхности" },
  { key: "surface", label: "Поверхность", group: "Поверхности" },
  { key: "surface-2", label: "Поверхность 2", group: "Поверхности" },
  { key: "bg-sidebar", label: "Фон бокового меню", group: "Поверхности" },
  { key: "border", label: "Граница", group: "Поверхности" },
  { key: "foreground", label: "Основной текст", group: "Текст" },
  { key: "muted", label: "Приглушённый текст", group: "Текст" },
  { key: "muted-2", label: "Очень приглушённый текст", group: "Текст" },
];

/**
 * Страница без собственных размеченных элементов: редактируется через общие
 * элементы, ограниченные областью этой страницы (см. compileConfig — правило
 * получает префикс [data-design-page="key"]). Собственных id здесь нет
 * намеренно: объявлять элемент, которого нет в разметке, значит показать
 * администратору настройку, которая ни на что не влияет.
 */
function simplePage(key: string, label: string, section: string, route: string): PageDef {
  return { key, label, section, route, elements: [] };
}

export const PAGES: PageDef[] = [
  {
    key: "home",
    label: "Главная",
    section: "Обзор",
    route: "/",
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
  },
  {
    key: "dashboard",
    label: "Статистика",
    section: "Обзор",
    route: "/dashboard",
    elements: [
      { id: "dashboard.root", label: "Вся страница" },
      { id: "dashboard.kpiGrid", label: "Сетка показателей", parent: "dashboard.root" },
    ],
  },
  simplePage("activities", "Активность", "Обзор", "/activities"),
  simplePage("players", "Состав", "Обзор", "/players"),
  simplePage("profile", "Мой профиль", "Обзор", "/profile"),
  simplePage("treasury", "Казна", "Экономика", "/treasury"),
  simplePage("payments", "Выплаты", "Экономика", "/payments"),
  simplePage("calculator", "Калькуляторы", "Инструменты", "/calculator"),
  simplePage("archeage", "ArcheAge", "Инструменты", "/archeage"),
  simplePage("users", "Пользователи", "Администрирование", "/users"),
  simplePage("dropCatalog", "Реестр дропа", "Администрирование", "/drop-catalog"),
  simplePage("activityBanners", "Баннеры активностей", "Администрирование", "/activity-banners"),
  simplePage("rbPurchase", "Расчёт покупки РБ", "Администрирование", "/rb-purchase"),
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
    elements: [
      { id: "activityDetail.root", label: "Вся страница" },
    ],
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
    elements: [
      { id: "playerDetail.root", label: "Вся страница" },
    ],
  },
];

export const PAGE_BY_KEY = new Map(PAGES.map((p) => [p.key, p]));

/** Все допустимые id элементов — и страничные, и общие. */
export function allowedElementIds(pageKey: string): Set<string> {
  const ids = new Set<string>(SHARED_ELEMENTS.map((e) => e.id));
  if (pageKey === SHARED_KEY) return ids;
  const page = PAGE_BY_KEY.get(pageKey);
  for (const e of page?.elements ?? []) ids.add(e.id);
  return ids;
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
