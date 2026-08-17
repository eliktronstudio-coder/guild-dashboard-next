import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireActivitiesManager } from "@/lib/auth";

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string; screenshotId: string }> }
) {
  const admin = await requireActivitiesManager();
  if (!admin) return NextResponse.json({ error: "Нет доступа." }, { status: 403 });

  const { id, screenshotId } = await params;
  await prisma.activityScreenshot.deleteMany({ where: { id: screenshotId, activityId: id } });

  return NextResponse.json({ ok: true });
}
