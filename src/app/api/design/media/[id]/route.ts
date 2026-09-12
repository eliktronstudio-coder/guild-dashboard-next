import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { findMediaUsage } from "@/lib/design/store";

/**
 * Удаление файла из медиатеки.
 *
 * Файл, который используется опубликованной страницей или сохранённой
 * версией, удалять нельзя: иначе на живом сайте появилась бы битая картинка,
 * а восстановление старой версии перестало бы работать.
 */
export async function DELETE(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: "Нет доступа." }, { status: 403 });
  if (!/^[a-z0-9]{20,40}$/i.test(id)) return NextResponse.json({ error: "Файл не найден." }, { status: 404 });

  const usage = await findMediaUsage(id);
  if (usage.length > 0) {
    return NextResponse.json(
      {
        error: `Файл используется: ${usage.join(", ")}. Сначала уберите его оттуда.`,
        usage,
      },
      { status: 409 }
    );
  }

  await prisma.designMedia.deleteMany({ where: { id } });
  return NextResponse.json({ ok: true });
}
