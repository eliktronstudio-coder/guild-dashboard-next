import { headers } from "next/headers";
import { requireAdmin } from "@/lib/auth";
import { getDraftCss, getPublishedCss } from "@/lib/design/store";
import { isKnownPageKey, pageKeyForPathname, SHARED_KEY } from "@/lib/design/registry";

export const PREVIEW_PARAM = "__design_preview";
export const PREVIEW_SHARED_PARAM = "__design_shared_draft";

export type DesignContext = {
  pageKey: string | null;
  css: string;
  isPreview: boolean;
};

/**
 * Решает, какое оформление показать на текущем запросе.
 *
 * Обычный посетитель всегда видит опубликованную версию. Черновик отдаётся
 * только если в адресе есть служебный параметр И запрос делает администратор —
 * права проверяются здесь, на сервере, а не в интерфейсе.
 */
export async function resolveDesign(): Promise<DesignContext> {
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
      const css = await getDraftCss(requestedPreview, includeSharedDraft);
      // Ключ берём из запрошенного предпросмотра: так шаблонные страницы
      // (карточка активности, профиль игрока) получают стили своего шаблона.
      return { pageKey: requestedPreview === SHARED_KEY ? routeKey : requestedPreview, css, isPreview: true };
    }
  }

  const css = await getPublishedCss(routeKey);
  return { pageKey: routeKey, css, isPreview: false };
}

/** Тег со скомпилированными стилями. Пустой конфиг не печатает ничего. */
export default function DesignStyles({ css }: { css: string }) {
  if (!css) return null;
  return <style id="xd-design" dangerouslySetInnerHTML={{ __html: css }} />;
}
