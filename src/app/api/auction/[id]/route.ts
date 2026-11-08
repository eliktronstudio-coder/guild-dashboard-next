import { ReversalError } from "@/lib/treasury-reversal";
import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { deleteAuction } from "@/lib/auction";

/**
 * Удаляет запись торгов из ленты победителей — только ГМ и админ.
 *
 * Выручка компенсируется с сохранением исходной операции казны:
 * лот без золота или золото без лота одинаково ломают сверку. Механика — в
 * src/lib/auction.ts, общая с тестами.
 */
export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const admin = await requireAdmin();
  if (!admin)
    return NextResponse.json({ error: "Нет доступа." }, { status: 403 });

  const { id } = await params;
  let removed;
  try {
    removed = await deleteAuction(id);
  } catch (error) {
    if (error instanceof ReversalError)
      return NextResponse.json(
        { error: error.message },
        { status: error.status },
      );
    throw error;
  }
  if (!removed)
    return NextResponse.json({ error: "Запись не найдена." }, { status: 404 });

  return NextResponse.json({ ok: true, ...removed });
}
