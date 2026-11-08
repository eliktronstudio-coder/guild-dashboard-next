import { prisma } from "@/lib/prisma";

// Когда игрок появляется в составе (регистрация на сайте или добавление
// админом) под ником, который уже числится "незарегистрированным" в
// каких-то активностях, — переносим его туда как настоящего участника
// и убираем из незарегистрированных.
export async function promoteMatchingGuests(
  playerId: string,
  playerName: string,
): Promise<number> {
  const normalizedName = playerName.trim().toLowerCase();
  if (!normalizedName) return 0;

  return prisma.$transaction(async (tx) => {
    await tx.appSetting.upsert({
      where: { key: "xd:activity-lock" },
      create: { key: "xd:activity-lock", value: "1" },
      update: { value: "1" },
    });
    const guests = await tx.activityGuest.findMany({
      where: { activity: { archiveId: null } },
    });
    const matches = guests.filter(
      (g) => g.name.trim().toLowerCase() === normalizedName,
    );
    for (const guest of matches) {
      await tx.activityParticipant.upsert({
        where: {
          activityId_playerId: { activityId: guest.activityId, playerId },
        },
        create: { activityId: guest.activityId, playerId },
        update: {},
      });
      await tx.activityGuest.delete({ where: { id: guest.id } });
    }
    return matches.length;
  });
}
