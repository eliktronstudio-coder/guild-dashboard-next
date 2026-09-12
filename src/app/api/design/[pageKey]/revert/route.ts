import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { isKnownPageKey } from "@/lib/design/registry";
import { getDesignState, revertDraft } from "@/lib/design/store";

/** Возвращает черновик страницы к её последней опубликованной версии. */
export async function POST(_request: NextRequest, { params }: { params: Promise<{ pageKey: string }> }) {
  const { pageKey } = await params;
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: "Нет доступа." }, { status: 403 });
  if (!isKnownPageKey(pageKey)) return NextResponse.json({ error: "Неизвестная страница." }, { status: 404 });

  await revertDraft(pageKey, admin.username);
  return NextResponse.json(await getDesignState(pageKey));
}
