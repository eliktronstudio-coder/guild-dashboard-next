import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/auth";

export async function DELETE(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: "Нет доступа." }, { status: 403 });

  const { id } = await params;

  // Если эта операция была продажей дропа (см. /api/drops/[id]/sell и
  // статус-тоггл в /api/drops/[id]), отменяем продажу и возвращаем
  // предмет в инвентарь — иначе он навсегда "теряется" со статусом
  // "Продано", ссылаясь на уже удалённую операцию.
  await prisma.$transaction([
    prisma.dropItem.updateMany({
      where: { treasuryTransactionId: id },
      data: { status: "Не продано", treasuryTransactionId: null, playerId: null },
    }),
    prisma.treasuryTransaction.delete({ where: { id } }),
  ]);

  return NextResponse.json({ ok: true });
}
