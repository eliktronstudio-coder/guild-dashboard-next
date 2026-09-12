import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { normalizeConfig } from "@/lib/design/compile";
import { isKnownPageKey } from "@/lib/design/registry";
import { getDesignState, saveDraft } from "@/lib/design/store";

/**
 * Черновик оформления одной страницы.
 *
 * Права проверяются на сервере в каждом методе: без этого черновики и
 * служебные данные утекали бы любому, кто знает адрес.
 */

async function guard(pageKey: string) {
  const admin = await requireAdmin();
  if (!admin) {
    return { error: NextResponse.json({ error: "Нет доступа." }, { status: 403 }) as NextResponse, admin: null };
  }
  if (!isKnownPageKey(pageKey)) {
    return { error: NextResponse.json({ error: "Неизвестная страница." }, { status: 404 }), admin: null };
  }
  return { error: null, admin };
}

export async function GET(_request: NextRequest, { params }: { params: Promise<{ pageKey: string }> }) {
  const { pageKey } = await params;
  const { error } = await guard(pageKey);
  if (error) return error;

  const state = await getDesignState(pageKey);
  return NextResponse.json(state);
}

export async function PUT(request: NextRequest, { params }: { params: Promise<{ pageKey: string }> }) {
  const { pageKey } = await params;
  const { error, admin } = await guard(pageKey);
  if (error) return error;

  const body = await request.json().catch(() => null);
  if (!body || typeof body !== "object") {
    return NextResponse.json({ error: "Некорректные данные." }, { status: 400 });
  }

  // Нормализация — она же проверка: всё, чего нет в реестре или что не прошло
  // валидацию значения, до базы не доходит.
  const config = normalizeConfig((body as { config?: unknown }).config, pageKey);
  await saveDraft(pageKey, config, admin!.username);

  const state = await getDesignState(pageKey);
  return NextResponse.json(state);
}
