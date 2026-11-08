import { activityMutationResponse } from "@/lib/activity-mutation";
import { NextRequest, NextResponse } from "next/server";
import { requireActivitiesManager } from "@/lib/auth";

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string; guestId: string }> },
) {
  const admin = await requireActivitiesManager();
  if (!admin)
    return NextResponse.json({ error: "Нет доступа." }, { status: 403 });

  const { id, guestId } = await params;
  return activityMutationResponse(id, async (tx) => {
    await tx.activityGuest.deleteMany({
      where: { id: guestId, activityId: id },
    });
    return NextResponse.json({ ok: true });
  });
}
