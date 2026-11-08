import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth";
import {
  reverseTreasuryTransaction,
  ReversalError,
} from "@/lib/treasury-reversal";
export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  if (!(await requireAdmin()))
    return NextResponse.json({ error: "Нет доступа." }, { status: 403 });
  try {
    return NextResponse.json(
      await reverseTreasuryTransaction((await params).id),
    );
  } catch (error) {
    if (error instanceof ReversalError)
      return NextResponse.json(
        { error: error.message },
        { status: error.status },
      );
    return NextResponse.json(
      { error: "Операция не завершена. Повторите запрос." },
      { status: 503 },
    );
  }
}
