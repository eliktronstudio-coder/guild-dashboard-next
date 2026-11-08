import { NextRequest, NextResponse } from "next/server";
import { getApprovedUser } from "@/lib/access";
import { getStatistics } from "@/lib/statistics";
import { csv } from "@/lib/report-filters";
export async function GET(request: NextRequest) {
  const user = await getApprovedUser();
  if (!user)
    return NextResponse.json({ error: "Нет доступа." }, { status: 403 });
  const report = await getStatistics(
    Object.fromEntries(request.nextUrl.searchParams),
    user,
    true,
  );
  if (report.error)
    return NextResponse.json({ error: report.error }, { status: 400 });
  return new NextResponse(
    csv([
      [
        "Игрок",
        "Класс",
        "Доступно",
        "Посещено",
        "Общая %",
        "Прайм %",
        "Мини-РБ %",
        "PvP",
        "Убийства",
        "Честь",
        "Начислено",
      ],
      ...report.rows.map((p) => [
        p.name,
        p.role,
        p.available,
        p.attended,
        p.attendance,
        p.prime,
        p.miniRb,
        p.pvp,
        p.kills,
        p.honor,
        p.salary,
      ]),
    ]),
    {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": 'attachment; filename="xd-statistics.csv"',
        "Cache-Control": "private, no-store",
        "X-Content-Type-Options": "nosniff",
      },
    },
  );
}
