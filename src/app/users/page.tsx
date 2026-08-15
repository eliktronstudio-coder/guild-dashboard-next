import { redirect } from "next/navigation";
import { requireAdmin } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import UsersTable from "@/components/admin/UsersTable";

export default async function UsersPage() {
  const admin = await requireAdmin();
  if (!admin) redirect("/dashboard");

  const [users, players] = await Promise.all([
    prisma.user.findMany({
      orderBy: { createdAt: "desc" },
      select: { id: true, username: true, role: true, createdAt: true },
    }),
    prisma.player.findMany({ select: { userId: true } }),
  ]);

  const linkedUserIds = new Set(players.map((p) => p.userId).filter(Boolean));

  return (
    <UsersTable
      users={users.map((u) => ({
        ...u,
        createdAt: u.createdAt.toISOString(),
        inRoster: linkedUserIds.has(u.id),
      }))}
      currentUserId={admin.sub}
    />
  );
}
