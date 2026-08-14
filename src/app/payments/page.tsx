import { getAllPayments, getAllPlayers } from "@/lib/queries";
import { getCurrentUser } from "@/lib/auth";
import PaymentsTable from "@/components/admin/PaymentsTable";

const dateFmt = new Intl.DateTimeFormat("ru-RU", { day: "numeric", month: "long" });

export default async function PaymentsPage() {
  const [payments, players, user] = await Promise.all([getAllPayments(), getAllPlayers(), getCurrentUser()]);

  return (
    <PaymentsTable
      payments={payments.map((p) => ({
        id: p.id,
        player: { id: p.player.id, name: p.player.name },
        amount: p.amount,
        status: p.status,
        date: dateFmt.format(p.date),
      }))}
      players={players.map((p) => ({ id: p.id, name: p.name }))}
      isAdmin={user?.role === "admin"}
    />
  );
}
