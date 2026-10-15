import { redirect } from "next/navigation";
import { requireAdmin } from "@/lib/auth";
import { getAllPlayers } from "@/lib/queries";
import RbPurchaseCalculator from "@/components/admin/RbPurchaseCalculator";

export default async function RbPurchasePage() {
  const admin = await requireAdmin();
  if (!admin) redirect("/dashboard");

  const players = await getAllPlayers();

  // Весь состав доступен для выбора — долю теперь указывают вручную для
  // каждого добавленного игрока, а не берут из посещаемости автоматически,
  // поэтому заранее отсеивать по порогу смысла нет.
  return (
    <RbPurchaseCalculator
      players={players.map((p) => ({
        id: p.id,
        name: p.name,
        role: p.role,
        attendancePctMiniRb: p.attendancePctMiniRb,
      }))}
    />
  );
}
