import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { SaleError, sellInventory } from "@/lib/sales";
export async function POST(request: NextRequest) {
  const user = await requireAdmin();
  if (!user)
    return NextResponse.json({ error: "Нет доступа." }, { status: 403 });
  try {
    const result = await sellInventory(
      await request.json().catch(() => null),
      user.sub,
      request.headers.get("Idempotency-Key") ?? "",
    );
    return NextResponse.json(result);
  } catch (error) {
    if (error instanceof SaleError)
      return NextResponse.json(
        { error: error.message },
        { status: error.status },
      );
    // SQLite busy/transaction conflicts are retryable with the same key.
    return NextResponse.json(
      { error: "Продажа не завершена. Повторите запрос с тем же ключом." },
      { status: 503 },
    );
  }
}
