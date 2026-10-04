const BUILD_HOST = "aje-calc.h1n.ru";
const SLOTS_TOTAL = 20;

export type BuildSummary = {
  level: number | null;
  heroicLevel: number | null;
  titleId: number | null;
  slotsFilled: number;
  slotsTotal: number;
};

/** Достаёт хэш сборки из ссылки вида https://aje-calc.h1n.ru/build/<hash>. */
export function extractBuildHash(url: string): string | null {
  try {
    const parsed = new URL(url);
    if (parsed.hostname !== BUILD_HOST) return null;
    const match = parsed.pathname.match(/\/build\/([a-zA-Z0-9]+)/);
    return match?.[1] ?? null;
  } catch {
    return null;
  }
}

/**
 * Публичные данные сборки с калькулятора — тот же запрос, который делает их
 * собственная страница /build/<hash>. Используется только для короткой
 * визуальной сводки (уровень, экипировано слотов), не для подмены самого
 * калькулятора.
 */
export async function fetchBuildSummary(hash: string): Promise<BuildSummary | null> {
  try {
    const res = await fetch(`https://${BUILD_HOST}/api/builds/${hash}`, {
      signal: AbortSignal.timeout(4000),
    });
    if (!res.ok) return null;
    const json = await res.json();
    const data = json?.data;
    if (!data || typeof data !== "object") return null;
    const slots = Array.isArray(data.slots) ? data.slots : [];
    return {
      level: typeof data.level === "number" ? data.level : null,
      heroicLevel: typeof data.heroic_level === "number" ? data.heroic_level : null,
      titleId: typeof data.title_id === "number" ? data.title_id : null,
      slotsFilled: slots.filter((s: unknown) => s != null).length,
      slotsTotal: SLOTS_TOTAL,
    };
  } catch {
    // Внешний сервис недоступен или ответ неожиданного формата — молча
    // падаем на обычную ссылку без сводки, а не роняем страницу профиля.
    return null;
  }
}

/** Добавляет сводку к каждой сохранённой сборке, параллельно и без падений. */
export async function enrichBuildsWithSummary<T extends { url: string }>(
  builds: T[]
): Promise<(T & { summary: BuildSummary | null })[]> {
  return Promise.all(
    builds.map(async (b) => {
      const hash = extractBuildHash(b.url);
      const summary = hash ? await fetchBuildSummary(hash) : null;
      return { ...b, summary };
    })
  );
}
