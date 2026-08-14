import { redirect } from "next/navigation";
import { requireAdmin } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import UsersTable from "@/components/admin/UsersTable";

export default async function UsersPage() {
  const admin = await requireAdmin();
  if (!admin) redirect("/dashboard");

  const users = await prisma.user.findMany({
    orderBy: { createdAt: "desc" },
    select: { id: true, username: true, role: true, createdAt: true },
  });

  return (
    <UsersTable
      users={users.map((u) => ({ ...u, createdAt: u.createdAt.toISOString() }))}
      currentUserId={admin.sub}
    />
  );
}
