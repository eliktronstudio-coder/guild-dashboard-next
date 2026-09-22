import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { isFullAdminRole } from "@/lib/accountRoles";
import { getDropCatalog } from "@/lib/queries";
import { getActiveAuction } from "@/lib/auction";
import { prisma } from "@/lib/prisma";
import AuctionBoard from "@/components/AuctionBoard";

export default async function AuctionPage() {
  const user = await getCurrentUser();
  if (!user || user.role === "random") redirect("/dashboard");

  const isAdmin = isFullAdminRole(user.role);

  // Ставить может только тот, чья учётная запись привязана к игроку состава:
  // имя ставки берётся отсюда, а не из формы, иначе можно было бы поставить
  // за другого.
  const [auction, player, catalog] = await Promise.all([
    getActiveAuction(),
    prisma.player.findUnique({ where: { userId: user.sub }, select: { id: true, name: true } }),
    isAdmin ? getDropCatalog() : Promise.resolve([]),
  ]);

  return (
    <AuctionBoard
      initialAuction={auction}
      isAdmin={isAdmin}
      me={player}
      catalog={catalog.map((c) => ({ id: c.id, name: c.name, imageUrl: c.imageUrl }))}
    />
  );
}
