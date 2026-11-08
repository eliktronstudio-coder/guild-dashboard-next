import { NextRequest, NextResponse } from "next/server";
import { activityMutationResponse } from "@/lib/activity-mutation";
import { requireActivitiesManager } from "@/lib/auth";

const MAX_GUESTS = 30;

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const admin = await requireActivitiesManager();
  if (!admin)
    return NextResponse.json({ error: "Нет доступа." }, { status: 403 });

  const { id } = await params;
  const body = await request.json().catch(() => null);
  const name = typeof body?.name === "string" ? body.name.trim() : "";

  if (!name || name.length > 40) {
    return NextResponse.json(
      { error: "Укажите имя (до 40 символов)." },
      { status: 400 },
    );
  }

  return activityMutationResponse(id, async (tx) => {
    const existing = await tx.activityGuest.count({
      where: { activityId: id },
    });
    if (existing >= MAX_GUESTS) {
      return NextResponse.json(
        { error: `Максимум ${MAX_GUESTS} незарегистрированных участников.` },
        { status: 400 },
      );
    }

    const guest = await tx.activityGuest.create({
      data: { activityId: id, name },
    });

    return NextResponse.json(guest, { status: 201 });
  });
}
