import { NextRequest, NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/auth";
import { isKnownPageKey, PAGE_BY_KEY, SHARED_KEY } from "@/lib/design/registry";
import { getDesignState, publishPage } from "@/lib/design/store";

/**
 * Публикация оформления ОДНОЙ страницы.
 *
 * Черновики остальных страниц не читаются и не трогаются — публикуется ровно
 * одна строка таблицы. Ответ «успех» возвращается только после того, как
 * транзакция реально завершилась.
 */
export async function POST(request: NextRequest, { params }: { params: Promise<{ pageKey: string }> }) {
  const { pageKey } = await params;
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: "Нет доступа." }, { status: 403 });
  if (!isKnownPageKey(pageKey)) return NextResponse.json({ error: "Неизвестная страница." }, { status: 404 });

  const body = (await request.json().catch(() => null)) as { revision?: number; note?: string } | null;
  const revision = Number(body?.revision);
  if (!Number.isInteger(revision) || revision < 0) {
    return NextResponse.json({ error: "Не указана версия страницы." }, { status: 400 });
  }
  const note = typeof body?.note === "string" ? body.note.slice(0, 200) : "";

  try {
    const result = await publishPage(pageKey, admin.username, revision, note);
    if (!result.ok) {
      return NextResponse.json(
        {
          error:
            "Эту страницу уже опубликовал другой администратор. Обновите редактор, чтобы не затереть его изменения.",
          conflict: true,
          currentRevision: result.currentRevision,
        },
        { status: 409 }
      );
    }

    // Сбрасываем кеш затронутых маршрутов, иначе посетители продолжат видеть
    // старую версию до истечения кеша.
    if (pageKey === SHARED_KEY) {
      revalidatePath("/", "layout");
    } else {
      const page = PAGE_BY_KEY.get(pageKey);
      if (page) revalidatePath(page.template ? `${page.route}/[id]` : page.route, page.template ? "page" : "page");
    }

    const state = await getDesignState(pageKey);
    return NextResponse.json(state);
  } catch (err) {
    if (err instanceof Error && err.message === "CONFLICT") {
      const state = await getDesignState(pageKey);
      return NextResponse.json(
        { error: "Страницу опубликовал другой администратор.", conflict: true, currentRevision: state.revision },
        { status: 409 }
      );
    }
    console.error("Ошибка публикации оформления:", err);
    return NextResponse.json({ error: "Не удалось опубликовать. Черновик сохранён." }, { status: 500 });
  }
}
