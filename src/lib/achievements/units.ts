import type { Unit } from "@/lib/achievements/catalog";

/**
 * Склонение единиц измерения: «1 событие», «2 события», «8 событий».
 *
 * Без этого карточки показывали бы «8 события» — мелочь, но она бросается в
 * глаза на каждой из тридцати карточек.
 */
const FORMS: Record<Unit, [one: string, few: string, many: string]> = {
  убийства: ["убийство", "убийства", "убийств"],
  события: ["событие", "события", "событий"],
  "очки чести": ["очко чести", "очка чести", "очков чести"],
  // Золото неисчисляемое: «1 золота» звучало бы дико, поэтому форма одна.
  золото: ["золота", "золота", "золота"],
  дни: ["день", "дня", "дней"],
};

export function pluralizeUnit(count: number, unit: Unit): string {
  const forms = FORMS[unit];
  if (!forms) return unit;

  const n = Math.abs(Math.floor(count));
  const mod10 = n % 10;
  const mod100 = n % 100;

  if (mod10 === 1 && mod100 !== 11) return forms[0];
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) return forms[1];
  return forms[2];
}
