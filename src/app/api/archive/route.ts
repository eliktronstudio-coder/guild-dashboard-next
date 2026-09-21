import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/auth";
import { getArchivePreview, getTreasuryBreakdown } from "@/lib/queries";
import { createArchiveInTx } from "@/lib/archive";

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
 * Создаёт архив за диапазон дат: помечает Activity/TreasuryTransaction в этом
 * диапазоне archiveId (не удаляет) и снимает состав с процентами
 * посещаемости, после чего живые расчёты казны и страница активностей их
 * больше не видят — баланс на сайте начинает считаться заново с 0, а история
 * остаётся доступна в самом архиве. Сама механика — в src/lib/archive.ts,
 * общая с тестами.
 */
export async function POST(request: NextRequest) {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: "Нет доступа." }, { status: 403 });

  const body = await request.json().catch(() => null);
  const range = parseRange(
    typeof body?.dateFrom === "string" ? body.dateFrom : null,
    typeof body?.dateTo === "string" ? body.dateTo : null
  );
  if (!range) return NextResponse.json({ error: "Укажите корректный диапазон дат." }, { status: 400 });

  const label = `${dateLabelFmt.format(range.dateFrom)} — ${dateLabelFmt.format(range.dateTo)}`;

  // Пул к выплате фиксируем ДО транзакции: внутри неё казна уезжает в архив
  // и живой остаток становится нулевым, так что посчитать, сколько было к
  // распределению за этот период, было бы уже не из чего.
  const breakdown = await getTreasuryBreakdown();
  const pools = { prime: breakdown.prime, miniRb: breakdown.miniRb };

  const archive = await prisma.$transaction((tx) =>
    createArchiveInTx(tx, { ...range, label, createdBy: admin.username, pools })
  );

  return NextResponse.json({ ok: true, archiveId: archive.id, label: archive.label });
}
