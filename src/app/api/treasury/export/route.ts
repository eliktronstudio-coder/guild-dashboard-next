import { NextRequest, NextResponse } from "next/server";
import { getApprovedUser } from "@/lib/access";
import { isFullAdminRole } from "@/lib/accountRoles";
import { prisma } from "@/lib/prisma";
import { ledgerFilters } from "@/lib/ledger-filters";
import { csv } from "@/lib/report-filters";
export async function GET(request: NextRequest) {
  const user = await getApprovedUser();
  if (!user)
    return NextResponse.json({ error: "Нет доступа." }, { status: 403 });
  const { where, error } = ledgerFilters(
    Object.fromEntries(request.nextUrl.searchParams),
    isFullAdminRole(user.role),
  );
  if (error) return NextResponse.json({ error }, { status: 400 });
  if ((await prisma.treasuryTransaction.count({ where })) > 100000)
    return NextResponse.json(
      { error: "Сузьте диапазон: экспорт ограничен 100 000 операциями." },
      { status: 400 },
    );
  const rows = await prisma.treasuryTransaction.findMany({
    where,
    orderBy: [{ date: "desc" }, { id: "desc" }],
    select: {
      date: true,
      description: true,
      amount: true,
      category: true,
      kind: true,
      reversalOfId: true,
    },
  });
  return new NextResponse(
    csv([
      ["Дата UTC", "Описание", "Сумма золота", "Категория", "Вид"],
      ...rows.map((row) => [
        row.date.toISOString(),
        row.description,
        row.amount,
        row.category,
        row.reversalOfId
          ? "Отмена"
          : row.kind === "payout"
            ? "Выплата"
            : "Операция",
      ]),
    ]),
    {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": 'attachment; filename="xd-treasury.csv"',
        "Cache-Control": "private, no-store",
        "X-Content-Type-Options": "nosniff",
      },
    },
  );
}
