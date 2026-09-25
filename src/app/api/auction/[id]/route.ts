import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { deleteAuction } from "@/lib/auction";

/**
 * Удаляет запись торгов из ленты победителей — только ГМ и админ.
 *
 * Вместе с записью убирается и операция казны, которой была заведена выручка:
 * лот без золота или золото без лота одинаково ломают сверку. Механика — в
 * src/lib/auction.ts, общая с тестами.
 */
export async function DELETE(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: "Нет доступа." }, { status: 403 });

  const { id } = await params;
  const removed = await deleteAuction(id);
  if (!removed) return NextResponse.json({ error: "Запись не найдена." }, { status: 404 });

  return NextResponse.json({ ok: true, ...removed });
}
