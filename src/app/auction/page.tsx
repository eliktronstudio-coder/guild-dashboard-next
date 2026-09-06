import { redirect } from "next/navigation";
import { requireAdmin } from "@/lib/auth";
import { getAllPlayers, getDropCatalog } from "@/lib/queries";
import AuctionBoard from "@/components/admin/AuctionBoard";

export default async function AuctionPage() {
  const admin = await requireAdmin();
  if (!admin) redirect("/dashboard");

  const [players, catalog] = await Promise.all([getAllPlayers(), getDropCatalog()]);

  return (
    <AuctionBoard
      players={players.map((p) => ({ id: p.id, name: p.name }))}
      catalog={catalog.map((c) => ({ id: c.id, name: c.name, imageUrl: c.imageUrl }))}
    />
  );
}
