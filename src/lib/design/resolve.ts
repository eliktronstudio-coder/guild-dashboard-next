import { cache } from "react";
import { headers } from "next/headers";
import { requireAdmin } from "@/lib/auth";
import {
  getDraftContent,
  getDraftCss,
  getPublishedContent,
  getPublishedCss,
} from "./store";
import { isKnownPageKey, pageKeyForPathname, SHARED_KEY } from "./registry";
import type { DesignBlock, SlotKey } from "./types";

export const PREVIEW_PARAM = "__design_preview";
export const PREVIEW_SHARED_PARAM = "__design_shared_draft";

export type ResolvedDesign = {
  pageKey: string | null;
  css: string;
  texts: Record<string, string>;
  blocks: Partial<Record<SlotKey, DesignBlock[]>>;
  isPreview: boolean;
};

/**
 * Решает, какое оформление показать на текущем запросе.
 *
 * Обычный посетитель всегда видит опубликованную версию. Черновик отдаётся
 * только если в адресе есть служебный параметр И запрос делает администратор —
 * права проверяются здесь, на сервере, а не в интерфейсе.
 *
 * cache() из React делает вызов однократным в пределах запроса: layout и
 * отдельные компоненты читают один и тот же результат без повторных запросов
 * к базе.
 */
export const resolveDesign = cache(async (): Promise<ResolvedDesign> => {
  const store = await headers();
  const pathname = store.get("x-design-pathname") ?? "/";
  const search = store.get("x-design-search") ?? "";

  const routeKey = pageKeyForPathname(pathname);
  const params = new URLSearchParams(search.startsWith("?") ? search.slice(1) : search);
  const requestedPreview = params.get(PREVIEW_PARAM);

  if (requestedPreview && isKnownPageKey(requestedPreview)) {
    const admin = await requireAdmin();
    if (admin) {
      const includeSharedDraft = params.get(PREVIEW_SHARED_PARAM) === "1";
      const [css, content] = await Promise.all([
        getDraftCss(requestedPreview, includeSharedDraft),
        getDraftContent(requestedPreview, includeSharedDraft),
      ]);
      return {
        // Ключ берём из запрошенного предпросмотра: так шаблонные страницы
        // получают стили своего шаблона.
        pageKey: requestedPreview === SHARED_KEY ? routeKey : requestedPreview,
        css,
        texts: content.texts,
        blocks: content.blocks,
        isPreview: true,
      };
    }
  }

  const [css, content] = await Promise.all([getPublishedCss(routeKey), getPublishedContent(routeKey)]);
  return { pageKey: routeKey, css, texts: content.texts, blocks: content.blocks, isPreview: false };
});

/** Подпись с учётом переопределения из редактора. */
export async function designText(id: string, fallback: string): Promise<string> {
  const design = await resolveDesign();
  return design.texts[id] ?? fallback;
}
