import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import type { Prisma } from "@/generated/prisma/client";
export async function activityMutationResponse(
  id: string,
  mutate: (tx: Prisma.TransactionClient) => Promise<NextResponse>,
) {
  try {
    return await prisma.$transaction(async (tx) => {
      // Obtain the SQLite write lock before checking archive membership.
      await tx.appSetting.upsert({
        where: { key: "xd:activity-lock" },
        create: { key: "xd:activity-lock", value: "1" },
        update: { value: "1" },
      });
      const activity = await tx.activity.findUnique({
        where: { id },
        select: { archiveId: true },
      });
      if (!activity)
        return NextResponse.json(
          { error: "Активность не найдена." },
          { status: 404 },
        );
      if (activity.archiveId)
        return NextResponse.json(
          { error: "Архивная активность доступна только для чтения." },
          { status: 409 },
        );
      return mutate(tx);
    });
  } catch {
    return NextResponse.json(
      { error: "Изменение не завершено. Обновите страницу и повторите." },
      { status: 503 },
    );
  }
}
