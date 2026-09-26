/**
 * Каталог достижений: 30 цепочек по шесть ступеней.
 *
 * Логика нигде не опирается на текст названия — только на `key` и `metric`.
 * Названия и описания админ сможет править, не ломая подсчёт.
 */

export const CATEGORIES = [
  "PvP",
  "Рейдовые боссы",
  "Активность",
  "Помощь гильдии",
  "Золото",
  "Стаж",
] as const;
export type Category = (typeof CATEGORIES)[number];

/** Единица измерения — показываем её на карточке рядом с прогрессом. */
export type Unit = "убийства" | "события" | "очки чести" | "золото" | "дни";

/**
 * Откуда берётся значение метрики.
 *
 * "ready"   — источник есть в текущих данных, считаем;
 * "pending" — источника нет, карточка показывает «Источник данных не
 *             настроен» и нулевой прогресс. Подставлять что-то похожее
 *             нельзя: посещение рейда не равно убийству босса, а участие в
 *             PvP не равно победе.
 */
export type SourceState = "ready" | "pending";

export type AchievementDef = {
  key: string;
  category: Category;
  title: string;
  /** Краткое условие для карточки. */
  condition: string;
  /** Развёрнутое пояснение для подробностей. */
  note?: string;
  unit: Unit;
  /** Идентификатор локальной SVG-иконки. */
  icon: string;
  source: SourceState;
  /** Секретные не показываются до первой ступени. Все стартовые — открытые. */
  secret?: boolean;
};

/**
 * Боссы задаются ключом, а не названием: в данных встречаются «Левиафан» и
 * «Разъярённый Левиафан», и сопоставление идёт по списку названий, который
 * админ сможет дополнить, не трогая код достижения.
 */
export const BOSS_ALIASES: Record<string, string[]> = {
  kraken: ["Кракен"],
  leviathan: ["Левиафан", "Разъярённый Левиафан", "Разъяренный Левиафан"],
  calidis: ["Калидис"],
  xanatos: ["Ксанатос"],
};

export const ACHIEVEMENTS: readonly AchievementDef[] = [
  /* ——— PvP ——— */
  {
    key: "pvp.battles",
    category: "PvP",
    title: "На линии фронта",
    condition: "Участия в подтверждённых PvP-сражениях",
    unit: "события",
    icon: "crossed-swords",
    source: "ready",
  },
  {
    key: "pvp.kills",
    category: "PvP",
    title: "Клинок войны",
    condition: "Убийства игроков в PvP",
    note: "Требует учёта убийств в карточке PvP-события.",
    unit: "убийства",
    icon: "blood-blade",
    source: "pending",
  },
  {
    key: "pvp.honor",
    category: "PvP",
    title: "Честь в бою",
    condition: "Очки чести, полученные именно в PvP",
    note: "Требует поля очков чести у PvP-события.",
    unit: "очки чести",
    icon: "honor-medal",
    source: "pending",
  },
  {
    key: "pvp.victories",
    category: "PvP",
    title: "Под знаменем победы",
    condition: "Победы в отмеченных PvP-событиях",
    note: "Победа отмечается вручную: участие победой не является.",
    unit: "события",
    icon: "victory-banner",
    source: "pending",
  },
  {
    key: "pvp.guildRaids",
    category: "PvP",
    title: "Боевое братство",
    condition: "Участия в гильдейских PvP-рейдах",
    note: "Требует отметки «гильдейский рейд» у PvP-события.",
    unit: "события",
    icon: "brotherhood",
    source: "pending",
  },
  {
    key: "pvp.defense",
    category: "PvP",
    title: "Защитник гильдии",
    condition: "Участия в событиях защиты гильдии",
    note: "Требует типа события «защита гильдии».",
    unit: "события",
    icon: "tower-shield",
    source: "pending",
  },

  /* ——— Рейдовые боссы ——— */
  {
    key: "boss.kraken",
    category: "Рейдовые боссы",
    title: "Гроза глубин",
    condition: "Подтверждённые убийства Кракена с участием игрока",
    note: "Считается только отмеченное убийство босса, не сам выход в рейд.",
    unit: "убийства",
    icon: "kraken",
    source: "pending",
  },
  {
    key: "boss.leviathan",
    category: "Рейдовые боссы",
    title: "Покоритель Левиафана",
    condition: "Подтверждённые убийства Левиафана с участием игрока",
    unit: "убийства",
    icon: "leviathan",
    source: "pending",
  },
  {
    key: "boss.calidis",
    category: "Рейдовые боссы",
    title: "Охотник на Калидиса",
    condition: "Подтверждённые убийства Калидиса с участием игрока",
    unit: "убийства",
    icon: "calidis",
    source: "pending",
  },
  {
    key: "boss.xanatos",
    category: "Рейдовые боссы",
    title: "Победитель Ксанатоса",
    condition: "Подтверждённые убийства Ксанатоса с участием игрока",
    unit: "убийства",
    icon: "xanatos",
    source: "pending",
  },
  {
    key: "boss.worldAny",
    category: "Рейдовые боссы",
    title: "Бич титанов",
    condition: "Убийства любых мировых рейдовых боссов с участием игрока",
    unit: "убийства",
    icon: "titan-skull",
    source: "pending",
  },
  {
    key: "boss.miniKills",
    category: "Рейдовые боссы",
    title: "Зачистка угроз",
    condition: "Убийства мини РБ с участием игрока",
    note: "Именно убийства: один рейд может дать несколько убийств, но остаётся одним посещением.",
    unit: "убийства",
    icon: "mini-boss",
    source: "pending",
  },

  /* ——— Активность ——— */
  {
    key: "act.prime",
    category: "Активность",
    title: "Всегда в строю",
    condition: "Посещённые праймы",
    unit: "события",
    icon: "formation",
    source: "ready",
  },
  {
    key: "act.mini",
    category: "Активность",
    title: "Малый отряд",
    condition: "Посещённые мероприятия мини РБ",
    unit: "события",
    icon: "small-squad",
    source: "ready",
  },
  {
    key: "act.unique",
    category: "Активность",
    title: "Жизнь гильдии",
    condition: "Уникальные посещённые гильдейские мероприятия",
    unit: "события",
    icon: "guild-life",
    source: "ready",
  },
  {
    key: "act.days",
    category: "Активность",
    title: "День за днём",
    condition: "Уникальные дни с участием хотя бы в одном мероприятии",
    unit: "дни",
    icon: "calendar-days",
    source: "ready",
  },
  {
    key: "act.full",
    category: "Активность",
    title: "От начала до конца",
    condition: "Мероприятия с подтверждённым полным участием",
    note: "Полное участие отмечается вручную: факт посещения им не является.",
    unit: "события",
    icon: "hourglass-full",
    source: "pending",
  },

  /* ——— Помощь гильдии ——— */
  {
    key: "help.organizer",
    category: "Помощь гильдии",
    title: "Сбор войска",
    condition: "Мероприятия, где игрок указан организатором",
    unit: "события",
    icon: "war-horn",
    source: "pending",
  },
  {
    key: "help.galleon",
    category: "Помощь гильдии",
    title: "Капитан боевого галеона",
    condition: "Подтверждённые призывы боевого галеона для мероприятий",
    unit: "события",
    icon: "galleon",
    source: "pending",
  },
  {
    key: "help.raidLeader",
    category: "Помощь гильдии",
    title: "Голос командира",
    condition: "Мероприятия, где игрок указан рейд-лидером",
    unit: "события",
    icon: "commander",
    source: "pending",
  },
  {
    key: "help.mentor",
    category: "Помощь гильдии",
    title: "Наставник",
    condition: "Подтверждённые завершённые занятия помощи новичкам",
    unit: "события",
    icon: "mentor",
    source: "pending",
  },
  {
    key: "help.requests",
    category: "Помощь гильдии",
    title: "Надёжное плечо",
    condition: "Выполненные и подтверждённые заявки на помощь гильдии",
    unit: "события",
    icon: "helping-hand",
    source: "pending",
  },

  /* ——— Золото ——— */
  {
    key: "gold.earned",
    category: "Золото",
    title: "Заработано в бою",
    condition: "Всего заработанного золота по окончательным начислениям",
    note: "Предварительная стоимость дропа заработком не считается.",
    unit: "золото",
    icon: "coin-pile",
    source: "ready",
  },
  {
    key: "gold.prime",
    category: "Золото",
    title: "Доля прайма",
    condition: "Золото, начисленное за прайм",
    unit: "золото",
    icon: "coin-prime",
    source: "ready",
  },
  {
    key: "gold.mini",
    category: "Золото",
    title: "Добыча малого отряда",
    condition: "Золото, начисленное за мини РБ",
    unit: "золото",
    icon: "coin-mini",
    source: "ready",
  },
  {
    key: "gold.donations",
    category: "Золото",
    title: "Вклад в общее дело",
    condition: "Подтверждённые добровольные пожертвования в казну",
    unit: "золото",
    icon: "donation-chest",
    source: "pending",
  },
  {
    key: "gold.paid",
    category: "Золото",
    title: "Полученная награда",
    condition: "Фактически выплаченное игроку золото",
    note: "Частичные выплаты учитываются по фактической сумме.",
    unit: "золото",
    icon: "reward-purse",
    source: "ready",
  },

  /* ——— Стаж ——— */
  {
    key: "tenure.days",
    category: "Стаж",
    title: "Верность знамени",
    condition: "Дни членства в гильдии после начала учёта",
    note: "Отсчёт идёт с более поздней даты: запуск системы или вступление игрока.",
    unit: "дни",
    icon: "banner-loyalty",
    source: "ready",
  },
  {
    key: "tenure.primeDays",
    category: "Стаж",
    title: "Ветеран прайма",
    condition: "Уникальные дни с посещением хотя бы одного прайма",
    note: "Это дни активности, а не календарный стаж: неактивный день не засчитывается.",
    unit: "дни",
    icon: "veteran-prime",
    source: "ready",
  },
  {
    key: "tenure.miniDays",
    category: "Стаж",
    title: "Ветеран малого отряда",
    condition: "Уникальные дни с посещением хотя бы одного мини РБ",
    note: "Это дни активности, а не календарный стаж: неактивный день не засчитывается.",
    unit: "дни",
    icon: "veteran-mini",
    source: "ready",
  },
];

export const ACHIEVEMENT_BY_KEY = new Map(ACHIEVEMENTS.map((a) => [a.key, a]));

/** Сколько очков даёт весь каталог, если закрыть его целиком. */
export function catalogMaxPoints(chainMax: number) {
  return ACHIEVEMENTS.length * chainMax;
}
