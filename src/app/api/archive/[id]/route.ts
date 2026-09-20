import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/auth";

/**
 * Удаляет запись архива. Сами активности/операции казны при этом НЕ
 * удаляются — у Activity.archiveId и TreasuryTransaction.archiveId стоит
 * onDelete: SetNull, поэтому они просто отвязываются от архива и снова
 * становятся видны как живые (казна и статистика пересчитают их обратно).
 */
export async function DELETE(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: "Нет доступа." }, { status: 403 });

  const { id } = await params;
  const archive = await prisma.archive.findUnique({ where: { id } });
  if (!archive) return NextResponse.json({ error: "Архив не найден." }, { status: 404 });

  await prisma.archive.delete({ where: { id } });

  return NextResponse.json({ ok: true });
}
