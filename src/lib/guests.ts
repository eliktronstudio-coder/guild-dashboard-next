import { prisma } from "@/lib/prisma";

// Когда игрок появляется в составе (регистрация на сайте или добавление
// админом) под ником, который уже числится "незарегистрированным" в
// каких-то активностях, — переносим его туда как настоящего участника
// и убираем из незарегистрированных.
export async function promoteMatchingGuests(playerId: string, playerName: string): Promise<number> {
  const normalizedName = playerName.trim().toLowerCase();
  if (!normalizedName) return 0;

  const guests = await prisma.activityGuest.findMany();
  const matches = guests.filter((g) => g.name.trim().toLowerCase() === normalizedName);
  if (matches.length === 0) return 0;

  for (const guest of matches) {
    const alreadyParticipant = await prisma.activityParticipant.findUnique({
      where: { activityId_playerId: { activityId: guest.activityId, playerId } },
    });
    if (!alreadyParticipant) {
      await prisma.activityParticipant.create({ data: { activityId: guest.activityId, playerId } });
    }
    await prisma.activityGuest.delete({ where: { id: guest.id } });
  }

  return matches.length;
}
