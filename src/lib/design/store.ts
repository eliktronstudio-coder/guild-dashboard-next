import { prisma } from "@/lib/prisma";
import { compileConfig, parseConfig, stableStringify } from "./compile";
import { isKnownPageKey, SHARED_KEY } from "./registry";
import { emptyConfig, type PageConfig } from "./types";

/** Читает (и при необходимости создаёт) запись оформления страницы. */
async function ensureRow(pageKey: string) {
  const existing = await prisma.pageDesign.findUnique({ where: { pageKey } });
  if (existing) return existing;
  return prisma.pageDesign.create({ data: { pageKey } });
}

export type DesignState = {
  pageKey: string;
  draft: PageConfig;
  published: PageConfig;
  revision: number;
  hasUnpublished: boolean;
  draftUpdatedAt: string | null;
  publishedAt: string | null;
  publishedBy: string | null;
};

export async function getDesignState(pageKey: string): Promise<DesignState> {
  if (!isKnownPageKey(pageKey)) throw new Error(`Неизвестная страница: ${pageKey}`);
  const row = await ensureRow(pageKey);
  const draft = parseConfig(row.draftJson, pageKey);
  const published = parseConfig(row.publishedJson, pageKey);
  return {
    pageKey,
    draft,
    published,
    revision: row.revision,
    hasUnpublished: stableStringify(draft) !== stableStringify(published),
    draftUpdatedAt: row.draftUpdatedAt?.toISOString() ?? null,
    publishedAt: row.publishedAt?.toISOString() ?? null,
    publishedBy: row.publishedBy,
  };
}

/** Сводка по всем страницам — для отметок «есть неопубликованные изменения». */
export async function getUnpublishedMap(): Promise<Record<string, boolean>> {
  const rows = await prisma.pageDesign.findMany({
    select: { pageKey: true, draftJson: true, publishedJson: true },
  });
  const map: Record<string, boolean> = {};
  for (const row of rows) {
    if (!isKnownPageKey(row.pageKey)) continue;
    const draft = parseConfig(row.draftJson, row.pageKey);
    const published = parseConfig(row.publishedJson, row.pageKey);
    map[row.pageKey] = stableStringify(draft) !== stableStringify(published);
  }
  return map;
}

export async function saveDraft(pageKey: string, config: PageConfig, username: string) {
  if (!isKnownPageKey(pageKey)) throw new Error(`Неизвестная страница: ${pageKey}`);
  await ensureRow(pageKey);
  await prisma.pageDesign.update({
    where: { pageKey },
    data: { draftJson: JSON.stringify(config), draftUpdatedBy: username },
  });
}

export type PublishResult =
  | { ok: true; revision: number }
  | { ok: false; reason: "conflict"; currentRevision: number };

/**
 * Публикует ТОЛЬКО указанную страницу: черновик переносится в published,
 * в историю пишется новая версия. Черновики других страниц не читаются и
 * не изменяются — изоляция обеспечивается тем, что у каждой страницы своя
 * строка и мы обновляем ровно одну.
 *
 * expectedRevision защищает от гонки двух администраторов: если кто-то
 * успел опубликовать раньше, обновление не найдёт строку с этим revision.
 */
export async function publishPage(
  pageKey: string,
  username: string,
  expectedRevision: number,
  note: string
): Promise<PublishResult> {
  if (!isKnownPageKey(pageKey)) throw new Error(`Неизвестная страница: ${pageKey}`);
  const row = await ensureRow(pageKey);
  if (row.revision !== expectedRevision) {
    return { ok: false, reason: "conflict", currentRevision: row.revision };
  }

  const draftJson = row.draftJson;
  const nextRevision = row.revision + 1;

  // Транзакция: публикация и запись в историю применяются целиком или никак,
  // поэтому опубликованная версия не может разойтись с историей.
  await prisma.$transaction(async (tx) => {
    const updated = await tx.pageDesign.updateMany({
      where: { pageKey, revision: expectedRevision },
      data: {
        publishedJson: draftJson,
        revision: nextRevision,
        publishedAt: new Date(),
        publishedBy: username,
      },
    });
    if (updated.count !== 1) throw new Error("CONFLICT");

    await tx.designVersion.create({
      data: {
        pageDesignId: row.id,
        configJson: draftJson,
        note,
        authorName: username,
      },
    });
  });

  return { ok: true, revision: nextRevision };
}

/** Возвращает черновик к последней опубликованной версии. */
export async function revertDraft(pageKey: string, username: string) {
  if (!isKnownPageKey(pageKey)) throw new Error(`Неизвестная страница: ${pageKey}`);
  const row = await ensureRow(pageKey);
  await prisma.pageDesign.update({
    where: { pageKey },
    data: { draftJson: row.publishedJson, draftUpdatedBy: username },
  });
}

export async function getHistory(pageKey: string, limit = 30) {
  if (!isKnownPageKey(pageKey)) throw new Error(`Неизвестная страница: ${pageKey}`);
  const row = await ensureRow(pageKey);
  const versions = await prisma.designVersion.findMany({
    where: { pageDesignId: row.id },
    orderBy: { createdAt: "desc" },
    take: limit,
    select: { id: true, note: true, authorName: true, createdAt: true },
  });
  return versions.map((v) => ({
    id: v.id,
    note: v.note,
    author: v.authorName,
    createdAt: v.createdAt.toISOString(),
  }));
}

/**
 * Кладёт выбранную версию в черновик. Публикация остаётся за кнопкой
 * «Применить», поэтому восстановление нельзя случайно выкатить посетителям,
 * и текущая опубликованная версия никуда не девается.
 */
export async function restoreVersionToDraft(pageKey: string, versionId: string, username: string) {
  if (!isKnownPageKey(pageKey)) throw new Error(`Неизвестная страница: ${pageKey}`);
  const row = await ensureRow(pageKey);
  const version = await prisma.designVersion.findFirst({
    where: { id: versionId, pageDesignId: row.id },
  });
  if (!version) return false;
  await prisma.pageDesign.update({
    where: { pageKey },
    data: { draftJson: version.configJson, draftUpdatedBy: username },
  });
  return true;
}

/**
 * CSS для публичного рендера страницы: общие настройки + настройки страницы.
 * Читается на каждый запрос страницы, поэтому выбираем только две строки.
 */
export async function getPublishedCss(pageKey: string | null): Promise<string> {
  const keys = pageKey ? [SHARED_KEY, pageKey] : [SHARED_KEY];
  const rows = await prisma.pageDesign.findMany({
    where: { pageKey: { in: keys } },
    select: { pageKey: true, publishedJson: true },
  });

  // Порядок важен: общие правила идут первыми, страничные — следом, чтобы
  // при равной специфичности побеждала страница.
  const ordered = keys
    .map((key) => rows.find((r) => r.pageKey === key))
    .filter((r): r is NonNullable<typeof r> => Boolean(r));

  return ordered
    .map((row) => compileConfig(parseConfig(row.publishedJson, row.pageKey), row.pageKey))
    .filter(Boolean)
    .join("");
}

/** CSS черновика — только для предпросмотра в админке. */
export async function getDraftCss(pageKey: string, includeSharedDraft: boolean): Promise<string> {
  const sharedRow = await prisma.pageDesign.findUnique({ where: { pageKey: SHARED_KEY } });
  const sharedJson = includeSharedDraft ? sharedRow?.draftJson : sharedRow?.publishedJson;
  const sharedCss = sharedJson ? compileConfig(parseConfig(sharedJson, SHARED_KEY), SHARED_KEY) : "";

  if (pageKey === SHARED_KEY) return sharedCss;

  const row = await prisma.pageDesign.findUnique({ where: { pageKey } });
  const pageCss = row ? compileConfig(parseConfig(row.draftJson, pageKey), pageKey) : "";
  return sharedCss + pageCss;
}

export { emptyConfig };
