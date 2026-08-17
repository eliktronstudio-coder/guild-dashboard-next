import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireActivitiesManager } from "@/lib/auth";

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string; guestId: string }> }
) {
  const admin = await requireActivitiesManager();
  if (!admin) return NextResponse.json({ error: "Нет доступа." }, { status: 403 });

  const { id, guestId } = await params;
  await prisma.activityGuest.deleteMany({ where: { id: guestId, activityId: id } });

  return NextResponse.json({ ok: true });
}
