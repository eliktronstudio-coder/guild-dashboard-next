import { prisma } from "@/lib/prisma";

const dateFmt = new Intl.DateTimeFormat("ru-RU", { day: "numeric", month: "long" });

export async function getAllPlayers() {
  return prisma.player.findMany({ orderBy: { createdAt: "asc" } });
}

export async function getPlayerById(id: string) {
  return prisma.player.findUnique({ where: { id } });
}

export async function topPlayersByAttendance(count = 5) {
  return prisma.player.findMany({ orderBy: { attendancePct: "desc" }, take: count });
}

export async function topPlayersByXp(count = 5) {
  return prisma.player.findMany({ orderBy: { xp: "desc" }, take: count });
}

export async function getAllActivities() {
  const activities = await prisma.activity.findMany({
    orderBy: { date: "desc" },
    include: { _count: { select: { participants: true } } },
  });
  return activities.map((a) => ({
    id: a.id,
    name: a.name,
    date: dateFmt.format(a.date),
    participants: a._count.participants,
  }));
}

export async function getActivityById(id: string) {
  const activity = await prisma.activity.findUnique({
    where: { id },
    include: { participants: { include: { player: true } } },
  });
  if (!activity) return null;
  return {
    id: activity.id,
    name: activity.name,
    date: dateFmt.format(activity.date),
    roster: activity.participants.map((p) => p.player),
  };
}
