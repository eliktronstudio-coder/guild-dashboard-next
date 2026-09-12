import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { isKnownPageKey } from "@/lib/design/registry";
import { getDesignState, getHistory, restoreVersionToDraft } from "@/lib/design/store";

/** Список опубликованных версий этой страницы. */
export async function GET(_request: NextRequest, { params }: { params: Promise<{ pageKey: string }> }) {
  const { pageKey } = await params;
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: "Нет доступа." }, { status: 403 });
  if (!isKnownPageKey(pageKey)) return NextResponse.json({ error: "Неизвестная страница." }, { status: 404 });

  return NextResponse.json({ versions: await getHistory(pageKey) });
}

/**
 * Восстановление версии кладёт её в ЧЕРНОВИК, а не публикует сразу:
 * так текущая опубликованная версия остаётся на месте, пока администратор
 * не нажмёт «Применить», и восстановление одной страницы не задевает другие.
 */
export async function POST(request: NextRequest, { params }: { params: Promise<{ pageKey: string }> }) {
  const { pageKey } = await params;
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: "Нет доступа." }, { status: 403 });
  if (!isKnownPageKey(pageKey)) return NextResponse.json({ error: "Неизвестная страница." }, { status: 404 });

  const body = (await request.json().catch(() => null)) as { versionId?: string } | null;
  const versionId = typeof body?.versionId === "string" ? body.versionId : "";
  if (!versionId) return NextResponse.json({ error: "Не указана версия." }, { status: 400 });

  const ok = await restoreVersionToDraft(pageKey, versionId, admin.username);
  if (!ok) return NextResponse.json({ error: "Версия не найдена." }, { status: 404 });

  return NextResponse.json(await getDesignState(pageKey));
}
