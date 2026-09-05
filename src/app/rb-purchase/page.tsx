import { redirect } from "next/navigation";
import { requireAdmin } from "@/lib/auth";
import { getAllPlayers } from "@/lib/queries";
import RbPurchaseCalculator from "@/components/admin/RbPurchaseCalculator";

export default async function RbPurchasePage() {
  const admin = await requireAdmin();
  if (!admin) redirect("/dashboard");

  const players = await getAllPlayers();

  return (
    <RbPurchaseCalculator
      players={players.map((p) => ({
        id: p.id,
        name: p.name,
        role: p.role,
        attendancePct: p.attendancePct,
        salaryCoefficient: p.salaryCoefficient,
      }))}
    />
  );
}
