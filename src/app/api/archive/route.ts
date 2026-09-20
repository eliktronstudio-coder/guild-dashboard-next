import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/auth";
import { getArchivePreview } from "@/lib/queries";

const dateLabelFmt = new Intl.DateTimeFormat("ru-RU", { day: "2-digit", month: "2-digit", year: "numeric" });

function parseRange(dateFromStr: string | null, dateToStr: string | null) {
  if (!dateFromStr || !dateToStr) return null;
  const dateFrom = new Date(dateFromStr);
  dateFrom.setHours(0, 0, 0, 0);
  const dateTo = new Date(dateToStr);
  dateTo.setHours(23, 59, 59, 999);
  if (Number.isNaN(dateFrom.getTime()) || Number.isNaN(dateTo.getTime()) || dateFrom > dateTo) return null;
  return { dateFrom, dateTo };
}

/** Сводка за выбранный диапазон дат — для подтверждения перед архивацией. */
export async function GET(request: NextRequest) {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: "Нет доступа." }, { status: 403 });

  const { searchParams } = new URL(request.url);
  const range = parseRange(searchParams.get("dateFrom"), searchParams.get("dateTo"));
  if (!range) return NextResponse.json({ error: "Укажите корректный диапазон дат." }, { status: 400 });

  const preview = await getArchivePreview(range.dateFrom, range.dateTo);
  return NextResponse.json(preview);
}

/**
 * Создаёт архив за диапазон дат: помечает Activity/TreasuryTransaction в
 * этом диапазоне archiveId (не удаляет), после чего живые расчёты казны и
 * страница активностей их больше не видят — баланс на сайте начинает
 * считаться заново с 0, а история остаётся доступна в самом архиве.
 */
export async function POST(request: NextRequest) {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: "Нет доступа." }, { status: 403 });

  const body = await request.json().catch(() => null);
  const range = parseRange(typeof body?.dateFrom === "string" ? body.dateFrom : null, typeof body?.dateTo === "string" ? body.dateTo : null);
  if (!range) return NextResponse.json({ error: "Укажите корректный диапазон дат." }, { status: 400 });

  const label = `${dateLabelFmt.format(range.dateFrom)} — ${dateLabelFmt.format(range.dateTo)}`;
  const dateWhere = { gte: range.dateFrom, lte: range.dateTo };

  const archive = await prisma.$transaction(async (tx) => {
    const created = await tx.archive.create({
      data: { dateFrom: range.dateFrom, dateTo: range.dateTo, label, createdBy: admin.username },
    });
    await tx.activity.updateMany({
      where: { date: dateWhere, archiveId: null },
      data: { archiveId: created.id },
    });
    await tx.treasuryTransaction.updateMany({
      where: { date: dateWhere, archiveId: null },
      data: { archiveId: created.id },
    });
    return created;
  });

  return NextResponse.json({ ok: true, archiveId: archive.id, label: archive.label });
}
