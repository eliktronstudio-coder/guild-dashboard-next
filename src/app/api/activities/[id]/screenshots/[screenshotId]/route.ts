import { activityMutationResponse } from "@/lib/activity-mutation";
import { getApprovedUser } from "@/lib/access";
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireActivitiesManager } from "@/lib/auth";

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string; screenshotId: string }> },
) {
  const admin = await requireActivitiesManager();
  if (!admin)
    return NextResponse.json({ error: "Нет доступа." }, { status: 403 });

  const { id, screenshotId } = await params;
  return activityMutationResponse(id, async tx => {
    await tx.activityScreenshot.deleteMany({ where: { id:screenshotId, activityId:id } });
    return NextResponse.json({ok:true});
  });
}

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string; screenshotId: string }> },
) {
  if (!(await getApprovedUser()))
    return NextResponse.json({ error: "Нет доступа." }, { status: 403 });
  const { id, screenshotId } = await params;
  const screenshot = await prisma.activityScreenshot.findFirst({
    where: { id: screenshotId, activityId: id },
    select: { imageUrl: true },
  });
  const match = screenshot?.imageUrl.match(
    /^data:(image\/(?:png|jpeg|webp|gif));base64,([A-Za-z0-9+/=\r\n]+)$/,
  );
  if (!match) return new NextResponse(null, { status: 404 });
  return new NextResponse(Buffer.from(match[2], "base64"), {
    headers: {
      "Content-Type": match[1],
      "Cache-Control": "private, no-store",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
