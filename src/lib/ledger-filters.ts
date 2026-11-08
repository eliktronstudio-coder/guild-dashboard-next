import type { Prisma } from "@/generated/prisma/client";
import { parseDay, value, type ReportParams } from "@/lib/report-filters";
export function ledgerFilters(params: ReportParams, admin: boolean) {
  const where: Prisma.TreasuryTransactionWhereInput = {
    archiveId: null,
    ...(!admin ? { kind: { not: "payout" } } : {}),
  };
  // SQL NOT does not include NULL, so explicitly include ordinary ledger entries.
  if (!admin) {
    delete where.kind;
    where.OR = [{ kind: null }, { kind: { not: "payout" } }];
  }
  const from = value(params.ledgerFrom);
  const to = value(params.ledgerTo);
  if (
    (from && !parseDay(from)) ||
    (to && !parseDay(to)) ||
    (from && to && from > to)
  )
    return { where, error: "Проверьте даты журнала операций." };
  if (from || to)
    where.date = {
      ...(from ? { gte: parseDay(from)! } : {}),
      ...(to ? { lt: new Date(parseDay(to)!.getTime() + 86400000) } : {}),
    };
  const query = value(params.ledgerQuery).trim().slice(0, 100);
  if (query) where.description = { contains: query };
  const direction = value(params.ledgerDirection);
  if (direction === "income") where.amount = { gt: 0 };
  if (direction === "expense") where.amount = { lt: 0 };
  return { where, error: null };
}
