import { getAllAuctionLots, getAllPlayers } from "@/lib/queries";
import { getCurrentUser } from "@/lib/auth";
import AuctionList from "@/components/admin/AuctionList";

export default async function AuctionPage() {
  const [lots, players, user] = await Promise.all([getAllAuctionLots(), getAllPlayers(), getCurrentUser()]);

  return (
    <AuctionList
      lots={lots.map((lot) => ({
        id: lot.id,
        item: lot.item,
        seller: { id: lot.seller.id, name: lot.seller.name },
        price: lot.price,
        endsAt: lot.endsAt.toISOString(),
      }))}
      players={players.map((p) => ({ id: p.id, name: p.name }))}
      isAdmin={user?.role === "admin"}
    />
  );
}
