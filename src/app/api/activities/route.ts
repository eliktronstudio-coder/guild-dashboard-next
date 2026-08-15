import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/auth";

const CATEGORIES = ["Мини-РБ", "Прайм"];
const MODES = ["PvE", "PvP"];
const DIFFICULTIES = ["Обычная", "Героическая"];

export async function POST(request: NextRequest) {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: "Нет доступа." }, { status: 403 });

  const body = await request.json().catch(() => null);
  const name = typeof body?.name === "string" ? body.name.trim() : "";
  const dateStr = typeof body?.date === "string" ? body.date : "";
  const category = typeof body?.category === "string" && CATEGORIES.includes(body.category) ? body.category : CATEGORIES[0];
  const mode = typeof body?.mode === "string" && MODES.includes(body.mode) ? body.mode : MODES[0];
  const difficulty =
    typeof body?.difficulty === "string" && DIFFICULTIES.includes(body.difficulty) ? body.difficulty : DIFFICULTIES[0];
  const isNight = Boolean(body?.isNight);
  const perAttendanceValue = Number.isFinite(Number(body?.perAttendanceValue)) ? Number(body.perAttendanceValue) : 0;
  const participantIds = Array.isArray(body?.participantIds)
    ? body.participantIds.filter((id: unknown) => typeof id === "string")
    : [];
  const dropEntries: { catalogItemId: string; quantity: number }[] = Array.isArray(body?.drops)
    ? body.drops
        .filter(
          (d: unknown): d is { catalogItemId: unknown; quantity: unknown } =>
            typeof d === "object" && d !== null
        )
        .map((d: { catalogItemId: unknown; quantity: unknown }) => ({
          catalogItemId: typeof d.catalogItemId === "string" ? d.catalogItemId : "",
          quantity: Number(d.quantity) || 1,
        }))
        .filter((d: { catalogItemId: string; quantity: number }) => d.catalogItemId)
    : [];

  if (!name || name.length > 60) {
    return NextResponse.json({ error: "Укажите название активности (до 60 символов)." }, { status: 400 });
  }

  const date = dateStr ? new Date(dateStr) : new Date();
  if (Number.isNaN(date.getTime())) {
    return NextResponse.json({ error: "Неверная дата." }, { status: 400 });
  }
  if (perAttendanceValue < 0) {
    return NextResponse.json({ error: "Сумма за посещение не может быть отрицательной." }, { status: 400 });
  }

  const catalogItems = dropEntries.length
    ? await prisma.dropCatalogItem.findMany({ where: { id: { in: dropEntries.map((d) => d.catalogItemId) } } })
    : [];
  const catalogById = new Map(catalogItems.map((c) => [c.id, c]));

  const activity = await prisma.activity.create({
    data: {
      name,
      date,
      category,
      mode,
      difficulty,
      isNight,
      perAttendanceValue,
      addedByUserId: admin.sub,
      participants: { create: participantIds.map((playerId: string) => ({ playerId })) },
      drops: {
        create: dropEntries
          .map((d) => {
            const catalogItem = catalogById.get(d.catalogItemId);
            if (!catalogItem) return null;
            return {
              item: catalogItem.name,
              value: catalogItem.price,
              quantity: Math.max(1, d.quantity),
              date,
              catalogItemId: catalogItem.id,
            };
          })
          .filter((d): d is NonNullable<typeof d> => d !== null),
      },
    },
  });

  return NextResponse.json(activity, { status: 201 });
}
