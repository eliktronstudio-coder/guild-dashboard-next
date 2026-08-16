import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/auth";

const CATEGORIES = ["Мини-РБ", "Прайм"];
const MODES = ["PvE", "PvP"];
const DIFFICULTIES = ["Обычная", "Героическая"];
const SCREENSHOT_KINDS = ["roster", "drop"];
const MAX_IMAGE_BYTES = 800_000;
const MAX_SCREENSHOTS_PER_KIND = 6;
const MAX_GUESTS = 30;

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
  const screenshotEntries: { kind: string; imageUrl: string }[] = Array.isArray(body?.screenshots)
    ? body.screenshots
        .filter(
          (s: unknown): s is { kind: unknown; imageUrl: unknown } => typeof s === "object" && s !== null
        )
        .map((s: { kind: unknown; imageUrl: unknown }) => ({
          kind: typeof s.kind === "string" ? s.kind : "",
          imageUrl: typeof s.imageUrl === "string" ? s.imageUrl : "",
        }))
        .filter((s: { kind: string; imageUrl: string }) => SCREENSHOT_KINDS.includes(s.kind) && s.imageUrl)
    : [];
  const guestNames: string[] = Array.isArray(body?.guestNames)
    ? body.guestNames
        .filter((n: unknown): n is string => typeof n === "string")
        .map((n: string) => n.trim())
        .filter((n: string) => n.length > 0 && n.length <= 40)
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
  for (const kind of SCREENSHOT_KINDS) {
    const count = screenshotEntries.filter((s) => s.kind === kind).length;
    if (count > MAX_SCREENSHOTS_PER_KIND) {
      return NextResponse.json({ error: `Максимум ${MAX_SCREENSHOTS_PER_KIND} скринов на раздел.` }, { status: 400 });
    }
  }
  if (screenshotEntries.some((s) => !s.imageUrl.startsWith("data:image/") || s.imageUrl.length > MAX_IMAGE_BYTES)) {
    return NextResponse.json({ error: "Скрин слишком большой или неверного формата (до ~600 КБ)." }, { status: 400 });
  }
  if (guestNames.length > MAX_GUESTS) {
    return NextResponse.json({ error: `Максимум ${MAX_GUESTS} незарегистрированных участников.` }, { status: 400 });
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
      screenshots: { create: screenshotEntries },
      guests: { create: guestNames.map((name) => ({ name })) },
    },
  });

  return NextResponse.json(activity, { status: 201 });
}
