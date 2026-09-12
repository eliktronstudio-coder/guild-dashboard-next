import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

/**
 * Удаление сохранённого блока.
 *
 * Заготовка — это шаблон: страницы, куда её уже вставили, получили свои
 * копии блоков с собственными идентификаторами, поэтому удаление шаблона
 * их не ломает.
 */
export async function DELETE(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: "Нет доступа." }, { status: 403 });
  if (!/^[a-z0-9]{20,40}$/i.test(id)) return NextResponse.json({ error: "Блок не найден." }, { status: 404 });

  await prisma.designSnippet.deleteMany({ where: { id } });
  return NextResponse.json({ ok: true });
}
