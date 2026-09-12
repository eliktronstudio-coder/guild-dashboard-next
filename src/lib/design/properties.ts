/**
 * Каталог редактируемых свойств. Каждое свойство знает свою CSS-запись,
 * тип поля в редакторе и правило проверки значения.
 *
 * Проверка нужна не только для удобства: значения попадают в CSS, поэтому
 * всё, что не прошло валидацию, отбрасывается. Так в таблицу стилей нельзя
 * протащить ни `expression()`, ни `url(javascript:...)`, ни закрывающую
 * скобку, ломающую правило.
 */

export type PropertyKind = "color" | "length" | "number" | "select" | "text" | "shadow" | "media" | "ratio";

export type PropertyDef = {
  key: string;
  label: string;
  css: string;
  kind: PropertyKind;
  group: PropertyGroupKey;
  /** Варианты для kind === "select". */
  options?: { value: string; label: string }[];
  /** Подсказка под полем. */
  hint?: string;
  /** Свойство имеет смысл для состояния наведения. */
  stateful?: boolean;
};

export type PropertyGroupKey =
  | "text"
  | "colors"
  | "background"
  | "spacing"
  | "border"
  | "size"
  | "effects"
  | "layout"
  | "position"
  | "motion";

export const PROPERTY_GROUPS: { key: PropertyGroupKey; label: string }[] = [
  { key: "text", label: "Текст и типографика" },
  { key: "colors", label: "Цвета" },
  { key: "background", label: "Фон и изображение" },
  { key: "spacing", label: "Отступы" },
  { key: "border", label: "Границы и скругления" },
  { key: "size", label: "Размеры" },
  { key: "layout", label: "Расположение" },
  { key: "position", label: "Позиционирование и наложение" },
  { key: "effects", label: "Эффекты" },
  { key: "motion", label: "Анимация" },
];

/** Длина: число с допустимой единицей, либо auto/none/ключевые слова. */
const LENGTH_RE = /^-?\d+(\.\d+)?(px|rem|em|%|vw|vh|ch)$|^0$|^auto$|^none$|^fit-content$|^max-content$|^min-content$/;

/** Цвет: hex, rgb/rgba, hsl/hsla, var(--токен-темы), transparent, currentColor. */
const COLOR_RE =
  /^#[0-9a-fA-F]{3,8}$|^rgba?\(\s*[\d.\s,%/]+\)$|^hsla?\(\s*[\d.\s,%/deg]+\)$|^var\(--[a-z0-9-]+\)$|^transparent$|^currentColor$/;

/** Тень: только цифры, единицы, пробелы и цвет — без функций и скобок. */
const SHADOW_RE = /^(none|(-?\d+(\.\d+)?(px|rem)\s+){2,3}(rgba?\([\d.\s,%/]+\)|#[0-9a-fA-F]{3,8}|var\(--[a-z0-9-]+\)))$/;

const NUMBER_RE = /^-?\d+(\.\d+)?$/;

/** Пропорция: «16 / 9», «1 / 1», «auto». */
const RATIO_RE = /^auto$|^\d+(\.\d+)?\s*\/\s*\d+(\.\d+)?$/;

/** id медиафайла — cuid из БД, только буквы и цифры. */
const MEDIA_ID_RE = /^[a-z0-9]{20,40}$/i;

export function isValidValue(def: PropertyDef, raw: string): boolean {
  const value = raw.trim();
  if (value === "") return true; // пусто = «не задано», допустимо
  // Общая защита: ни один вариант не должен уметь закрыть правило или начать новое.
  if (/[;{}<>\\]/.test(value)) return false;
  // url( ) разрешаем только для медиа-свойства и только в виде, который
  // собирает сам компилятор, — см. ветку "media" ниже.
  if (/javascript:|expression\(|@import/i.test(value)) return false;
  if (def.kind !== "media" && /url\(/i.test(value)) return false;

  switch (def.kind) {
    case "color":
      return COLOR_RE.test(value);
    case "length":
      return LENGTH_RE.test(value);
    case "number":
      return NUMBER_RE.test(value);
    case "shadow":
      return SHADOW_RE.test(value);
    case "ratio":
      return RATIO_RE.test(value);
    case "media":
      // Хранится не CSS, а идентификатор файла: адрес формирует компилятор,
      // поэтому подставить произвольный url() через настройку нельзя.
      return MEDIA_ID_RE.test(value);
    case "select":
      return (def.options ?? []).some((o) => o.value === value);
    case "text":
      // Используется для font-family: список имён шрифтов в кавычках или без.
      return /^[a-zA-Zа-яА-Я0-9\s,'"-]+$/.test(value) && value.length <= 120;
    default:
      return false;
  }
}

const sides = [
  { k: "Top", ru: "сверху" },
  { k: "Right", ru: "справа" },
  { k: "Bottom", ru: "снизу" },
  { k: "Left", ru: "слева" },
];

function sideProps(
  prefix: "padding" | "margin",
  label: string,
  group: PropertyGroupKey
): PropertyDef[] {
  return sides.map(({ k, ru }) => ({
    key: `${prefix}${k}`,
    label: `${label} ${ru}`,
    css: `${prefix}-${k.toLowerCase()}`,
    kind: "length" as const,
    group,
  }));
}

export const PROPERTIES: PropertyDef[] = [
  // --- Текст ---
  {
    key: "fontFamily",
    label: "Шрифт",
    css: "font-family",
    kind: "text",
    group: "text",
    hint: "Например: var(--font-heading) или Georgia, serif",
  },
  { key: "fontSize", label: "Размер шрифта", css: "font-size", kind: "length", group: "text" },
  {
    key: "fontWeight",
    label: "Насыщенность",
    css: "font-weight",
    kind: "select",
    group: "text",
    options: [
      { value: "300", label: "300 — светлый" },
      { value: "400", label: "400 — обычный" },
      { value: "500", label: "500 — средний" },
      { value: "600", label: "600 — полужирный" },
      { value: "700", label: "700 — жирный" },
      { value: "900", label: "900 — чёрный" },
    ],
  },
  {
    key: "fontStyle",
    label: "Начертание",
    css: "font-style",
    kind: "select",
    group: "text",
    options: [
      { value: "normal", label: "Прямое" },
      { value: "italic", label: "Курсив" },
    ],
  },
  { key: "lineHeight", label: "Межстрочный интервал", css: "line-height", kind: "number", group: "text" },
  { key: "letterSpacing", label: "Межбуквенное расстояние", css: "letter-spacing", kind: "length", group: "text" },
  {
    key: "textTransform",
    label: "Регистр",
    css: "text-transform",
    kind: "select",
    group: "text",
    options: [
      { value: "none", label: "Как есть" },
      { value: "uppercase", label: "ВЕРХНИЙ" },
      { value: "lowercase", label: "нижний" },
      { value: "capitalize", label: "С Заглавной" },
    ],
  },
  {
    key: "textAlign",
    label: "Выравнивание",
    css: "text-align",
    kind: "select",
    group: "text",
    options: [
      { value: "left", label: "По левому краю" },
      { value: "center", label: "По центру" },
      { value: "right", label: "По правому краю" },
      { value: "justify", label: "По ширине" },
    ],
  },
  {
    key: "textDecoration",
    label: "Подчёркивание",
    css: "text-decoration",
    kind: "select",
    group: "text",
    stateful: true,
    options: [
      { value: "none", label: "Нет" },
      { value: "underline", label: "Подчёркнутый" },
      { value: "line-through", label: "Зачёркнутый" },
    ],
  },
  {
    key: "whiteSpace",
    label: "Перенос текста",
    css: "white-space",
    kind: "select",
    group: "text",
    options: [
      { value: "normal", label: "Переносить" },
      { value: "nowrap", label: "В одну строку" },
    ],
  },

  // --- Цвета ---
  { key: "color", label: "Цвет текста", css: "color", kind: "color", group: "colors", stateful: true },
  {
    key: "backgroundColor",
    label: "Цвет фона",
    css: "background-color",
    kind: "color",
    group: "colors",
    stateful: true,
  },
  { key: "iconColor", label: "Цвет иконок", css: "--icon-color", kind: "color", group: "colors", stateful: true },

  // --- Фон и изображение ---
  {
    key: "backgroundGradient",
    label: "Градиент фона",
    css: "background-image",
    kind: "select",
    group: "background",
    options: [
      { value: "none", label: "Нет" },
      { value: "linear-gradient(90deg, var(--accent-soft), transparent)", label: "Акцент слева направо" },
      { value: "linear-gradient(180deg, var(--surface-2), var(--surface))", label: "Поверхность сверху вниз" },
      { value: "linear-gradient(135deg, var(--accent-soft), var(--surface-2))", label: "Акцент по диагонали" },
      { value: "linear-gradient(180deg, transparent, rgba(0,0,0,.55))", label: "Затемнение снизу" },
    ],
  },
  {
    key: "backgroundMedia",
    label: "Фоновое изображение",
    css: "background-image",
    kind: "media",
    group: "background",
    hint: "Выберите файл из медиатеки.",
  },
  {
    key: "backgroundSize",
    label: "Вписывание фона",
    css: "background-size",
    kind: "select",
    group: "background",
    options: [
      { value: "cover", label: "Заполнить (cover)" },
      { value: "contain", label: "Вписать (contain)" },
      { value: "auto", label: "Исходный размер" },
      { value: "100% 100%", label: "Растянуть" },
    ],
  },
  {
    key: "backgroundPosition",
    label: "Фокус фона",
    css: "background-position",
    kind: "select",
    group: "background",
    options: [
      { value: "center", label: "По центру" },
      { value: "top", label: "Сверху" },
      { value: "bottom", label: "Снизу" },
      { value: "left", label: "Слева" },
      { value: "right", label: "Справа" },
      { value: "center 25%", label: "Выше центра" },
      { value: "center 75%", label: "Ниже центра" },
    ],
  },
  {
    key: "backgroundRepeat",
    label: "Повтор фона",
    css: "background-repeat",
    kind: "select",
    group: "background",
    options: [
      { value: "no-repeat", label: "Без повтора" },
      { value: "repeat", label: "Повторять" },
      { value: "repeat-x", label: "По горизонтали" },
      { value: "repeat-y", label: "По вертикали" },
    ],
  },
  {
    key: "objectFit",
    label: "Вписывание картинки",
    css: "object-fit",
    kind: "select",
    group: "background",
    options: [
      { value: "cover", label: "Заполнить" },
      { value: "contain", label: "Вписать целиком" },
      { value: "fill", label: "Растянуть" },
      { value: "none", label: "Не масштабировать" },
    ],
  },
  {
    key: "objectPosition",
    label: "Фокусная точка картинки",
    css: "object-position",
    kind: "select",
    group: "background",
    options: [
      { value: "center", label: "По центру" },
      { value: "top", label: "Сверху" },
      { value: "bottom", label: "Снизу" },
      { value: "left", label: "Слева" },
      { value: "right", label: "Справа" },
    ],
  },

  // --- Отступы ---
  { key: "padding", label: "Внутренний отступ", css: "padding", kind: "length", group: "spacing" },
  ...sideProps("padding", "Внутренний", "spacing"),
  { key: "margin", label: "Внешний отступ", css: "margin", kind: "length", group: "spacing" },
  ...sideProps("margin", "Внешний", "spacing"),
  { key: "gap", label: "Расстояние между элементами", css: "gap", kind: "length", group: "spacing" },

  // --- Границы ---
  { key: "borderWidth", label: "Толщина границы", css: "border-width", kind: "length", group: "border" },
  {
    key: "borderStyle",
    label: "Стиль границы",
    css: "border-style",
    kind: "select",
    group: "border",
    options: [
      { value: "none", label: "Нет" },
      { value: "solid", label: "Сплошная" },
      { value: "dashed", label: "Пунктир" },
      { value: "dotted", label: "Точки" },
    ],
  },
  { key: "borderColor", label: "Цвет границы", css: "border-color", kind: "color", group: "border", stateful: true },
  { key: "borderRadius", label: "Скругление", css: "border-radius", kind: "length", group: "border" },
  {
    key: "borderTopLeftRadius",
    label: "Скругление — верх слева",
    css: "border-top-left-radius",
    kind: "length",
    group: "border",
  },
  {
    key: "borderTopRightRadius",
    label: "Скругление — верх справа",
    css: "border-top-right-radius",
    kind: "length",
    group: "border",
  },
  {
    key: "borderBottomRightRadius",
    label: "Скругление — низ справа",
    css: "border-bottom-right-radius",
    kind: "length",
    group: "border",
  },
  {
    key: "borderBottomLeftRadius",
    label: "Скругление — низ слева",
    css: "border-bottom-left-radius",
    kind: "length",
    group: "border",
  },

  // --- Размеры ---
  { key: "width", label: "Ширина", css: "width", kind: "length", group: "size" },
  { key: "height", label: "Высота", css: "height", kind: "length", group: "size" },
  { key: "minWidth", label: "Мин. ширина", css: "min-width", kind: "length", group: "size" },
  { key: "maxWidth", label: "Макс. ширина", css: "max-width", kind: "length", group: "size" },
  { key: "minHeight", label: "Мин. высота", css: "min-height", kind: "length", group: "size" },
  { key: "maxHeight", label: "Макс. высота", css: "max-height", kind: "length", group: "size" },

  // --- Расположение ---
  {
    key: "display",
    label: "Отображение",
    css: "display",
    kind: "select",
    group: "layout",
    options: [
      { value: "block", label: "Блок" },
      { value: "flex", label: "Flex" },
      { value: "grid", label: "Сетка" },
      { value: "inline-flex", label: "Строчный flex" },
      { value: "none", label: "Скрыть" },
    ],
    hint: "«Скрыть» убирает элемент только визуально, данные остаются.",
  },
  {
    key: "flexDirection",
    label: "Направление flex",
    css: "flex-direction",
    kind: "select",
    group: "layout",
    options: [
      { value: "row", label: "В строку" },
      { value: "column", label: "В столбец" },
      { value: "row-reverse", label: "В строку, обратно" },
      { value: "column-reverse", label: "В столбец, обратно" },
    ],
  },
  {
    key: "flexWrap",
    label: "Перенос flex",
    css: "flex-wrap",
    kind: "select",
    group: "layout",
    options: [
      { value: "nowrap", label: "Без переноса" },
      { value: "wrap", label: "С переносом" },
    ],
  },
  {
    key: "justifyContent",
    label: "Выравнивание по основной оси",
    css: "justify-content",
    kind: "select",
    group: "layout",
    options: [
      { value: "flex-start", label: "В начало" },
      { value: "center", label: "По центру" },
      { value: "flex-end", label: "В конец" },
      { value: "space-between", label: "По краям" },
      { value: "space-around", label: "Равномерно" },
    ],
  },
  {
    key: "alignItems",
    label: "Выравнивание по поперечной оси",
    css: "align-items",
    kind: "select",
    group: "layout",
    options: [
      { value: "stretch", label: "Растянуть" },
      { value: "flex-start", label: "В начало" },
      { value: "center", label: "По центру" },
      { value: "flex-end", label: "В конец" },
      { value: "baseline", label: "По базовой линии" },
    ],
  },
  {
    key: "gridTemplateColumns",
    label: "Колонки сетки",
    css: "grid-template-columns",
    kind: "select",
    group: "layout",
    options: [
      { value: "repeat(1, minmax(0, 1fr))", label: "1 колонка" },
      { value: "repeat(2, minmax(0, 1fr))", label: "2 колонки" },
      { value: "repeat(3, minmax(0, 1fr))", label: "3 колонки" },
      { value: "repeat(4, minmax(0, 1fr))", label: "4 колонки" },
    ],
  },
  {
    key: "overflow",
    label: "Переполнение",
    css: "overflow",
    kind: "select",
    group: "layout",
    options: [
      { value: "visible", label: "Показывать" },
      { value: "hidden", label: "Обрезать" },
      { value: "auto", label: "Прокрутка при необходимости" },
    ],
  },
  { key: "order", label: "Порядок", css: "order", kind: "number", group: "layout" },
  { key: "gridTemplateRows", label: "Строки сетки", css: "grid-template-rows", kind: "select", group: "layout",
    options: [
      { value: "auto", label: "По содержимому" },
      { value: "repeat(2, minmax(0, 1fr))", label: "2 равные строки" },
      { value: "repeat(3, minmax(0, 1fr))", label: "3 равные строки" },
    ],
  },
  { key: "flexGrow", label: "Растягивание (flex-grow)", css: "flex-grow", kind: "number", group: "layout" },
  { key: "flexShrink", label: "Сжатие (flex-shrink)", css: "flex-shrink", kind: "number", group: "layout" },
  { key: "flexBasis", label: "Базовый размер (flex-basis)", css: "flex-basis", kind: "length", group: "layout" },
  {
    key: "alignSelf",
    label: "Своё выравнивание",
    css: "align-self",
    kind: "select",
    group: "layout",
    options: [
      { value: "auto", label: "Как у контейнера" },
      { value: "flex-start", label: "В начало" },
      { value: "center", label: "По центру" },
      { value: "flex-end", label: "В конец" },
      { value: "stretch", label: "Растянуть" },
    ],
  },
  { key: "overflowX", label: "Переполнение по X", css: "overflow-x", kind: "select", group: "layout",
    options: [
      { value: "visible", label: "Показывать" },
      { value: "hidden", label: "Обрезать" },
      { value: "auto", label: "Прокрутка" },
    ],
  },
  { key: "overflowY", label: "Переполнение по Y", css: "overflow-y", kind: "select", group: "layout",
    options: [
      { value: "visible", label: "Показывать" },
      { value: "hidden", label: "Обрезать" },
      { value: "auto", label: "Прокрутка" },
    ],
  },
  { key: "aspectRatio", label: "Соотношение сторон", css: "aspect-ratio", kind: "ratio", group: "layout",
    hint: "Например: 16 / 9" },

  // --- Позиционирование ---
  {
    key: "position",
    label: "Тип позиционирования",
    css: "position",
    kind: "select",
    group: "position",
    options: [
      { value: "static", label: "Обычное" },
      { value: "relative", label: "Относительное" },
      { value: "absolute", label: "Абсолютное" },
      { value: "sticky", label: "Прилипающее" },
      { value: "fixed", label: "Фиксированное" },
    ],
  },
  { key: "top", label: "Сверху", css: "top", kind: "length", group: "position" },
  { key: "right", label: "Справа", css: "right", kind: "length", group: "position" },
  { key: "bottom", label: "Снизу", css: "bottom", kind: "length", group: "position" },
  { key: "left", label: "Слева", css: "left", kind: "length", group: "position" },
  { key: "zIndex", label: "Порядок наложения", css: "z-index", kind: "number", group: "position" },

  // --- Эффекты ---
  { key: "opacity", label: "Прозрачность", css: "opacity", kind: "number", group: "effects", stateful: true },
  {
    key: "boxShadow",
    label: "Тень блока",
    css: "box-shadow",
    kind: "shadow",
    group: "effects",
    stateful: true,
    hint: "Например: 0 4px 12px rgba(0,0,0,0.35)",
  },
  {
    key: "textShadow",
    label: "Тень текста",
    css: "text-shadow",
    kind: "shadow",
    group: "effects",
    stateful: true,
    hint: "Например: 0 1px 2px rgba(0,0,0,0.6)",
  },
  {
    key: "backdropBlur",
    label: "Размытие за элементом",
    css: "backdrop-filter",
    kind: "select",
    group: "effects",
    options: [
      { value: "none", label: "Нет" },
      { value: "blur(4px)", label: "Слабое" },
      { value: "blur(8px)", label: "Среднее" },
      { value: "blur(16px)", label: "Сильное" },
    ],
  },
  {
    key: "filterBlur",
    label: "Размытие элемента",
    css: "filter",
    kind: "select",
    group: "effects",
    options: [
      { value: "none", label: "Нет" },
      { value: "blur(2px)", label: "Слабое" },
      { value: "blur(6px)", label: "Среднее" },
      { value: "grayscale(1)", label: "Чёрно-белое" },
      { value: "brightness(1.15)", label: "Ярче" },
      { value: "brightness(0.85)", label: "Темнее" },
    ],
  },
  {
    key: "cursor",
    label: "Курсор",
    css: "cursor",
    kind: "select",
    group: "effects",
    options: [
      { value: "auto", label: "Обычный" },
      { value: "pointer", label: "Палец" },
      { value: "not-allowed", label: "Запрещено" },
      { value: "default", label: "Стрелка" },
    ],
  },

  // --- Анимация ---
  {
    key: "transitionProperty",
    label: "Что анимировать",
    css: "transition-property",
    kind: "select",
    group: "motion",
    options: [
      { value: "all", label: "Все свойства" },
      { value: "colors", label: "Только цвета" },
      { value: "transform", label: "Только сдвиг/масштаб" },
      { value: "opacity", label: "Только прозрачность" },
      { value: "none", label: "Ничего" },
    ],
  },
  {
    key: "transitionDuration",
    label: "Длительность перехода",
    css: "transition-duration",
    kind: "select",
    group: "motion",
    options: [
      { value: "0ms", label: "Без анимации" },
      { value: "120ms", label: "120 мс" },
      { value: "180ms", label: "180 мс" },
      { value: "300ms", label: "300 мс" },
      { value: "500ms", label: "500 мс" },
      { value: "800ms", label: "800 мс" },
    ],
  },
  {
    key: "transitionDelay",
    label: "Задержка перехода",
    css: "transition-delay",
    kind: "select",
    group: "motion",
    options: [
      { value: "0ms", label: "Без задержки" },
      { value: "100ms", label: "100 мс" },
      { value: "200ms", label: "200 мс" },
      { value: "400ms", label: "400 мс" },
    ],
  },
  {
    key: "transitionTimingFunction",
    label: "Плавность",
    css: "transition-timing-function",
    kind: "select",
    group: "motion",
    options: [
      { value: "linear", label: "Равномерно" },
      { value: "ease", label: "Плавно" },
      { value: "ease-in", label: "Разгон" },
      { value: "ease-out", label: "Торможение" },
      { value: "ease-in-out", label: "Разгон и торможение" },
      { value: "cubic-bezier(0.34, 1.56, 0.64, 1)", label: "С отскоком" },
    ],
  },
  {
    key: "hoverTransform",
    label: "Сдвиг при наведении",
    css: "transform",
    kind: "select",
    group: "motion",
    stateful: true,
    options: [
      { value: "none", label: "Нет" },
      { value: "translateY(-2px)", label: "Приподнять" },
      { value: "translateY(2px)", label: "Опустить" },
      { value: "scale(1.02)", label: "Чуть увеличить" },
      { value: "scale(0.98)", label: "Чуть уменьшить" },
    ],
  },
  {
    key: "appearAnimation",
    label: "Появление",
    css: "animation-name",
    kind: "select",
    group: "motion",
    hint: "Учитывает системную настройку «уменьшить анимацию».",
    options: [
      { value: "none", label: "Нет" },
      { value: "xd-fade-in", label: "Проявление" },
      { value: "xd-slide-up", label: "Снизу вверх" },
      { value: "xd-slide-down", label: "Сверху вниз" },
      { value: "xd-zoom-in", label: "Увеличение" },
    ],
  },
  {
    key: "appearDuration",
    label: "Длительность появления",
    css: "animation-duration",
    kind: "select",
    group: "motion",
    options: [
      { value: "200ms", label: "200 мс" },
      { value: "400ms", label: "400 мс" },
      { value: "700ms", label: "700 мс" },
      { value: "1200ms", label: "1200 мс" },
    ],
  },
  {
    key: "appearDelay",
    label: "Задержка появления",
    css: "animation-delay",
    kind: "select",
    group: "motion",
    options: [
      { value: "0ms", label: "Без задержки" },
      { value: "150ms", label: "150 мс" },
      { value: "300ms", label: "300 мс" },
      { value: "600ms", label: "600 мс" },
    ],
  },
];

/** Свойства появления объединяются в один animation — их нужно знать компилятору. */
export const APPEAR_PROPS = new Set(["appearAnimation", "appearDuration", "appearDelay"]);

/** Значения transition-property, которые раскрываются в список свойств. */
export const TRANSITION_PROPERTY_MAP: Record<string, string> = {
  colors: "background-color, border-color, color, box-shadow",
  all: "all",
  transform: "transform",
  opacity: "opacity",
  none: "none",
};

export const PROPERTY_BY_KEY = new Map(PROPERTIES.map((p) => [p.key, p]));
