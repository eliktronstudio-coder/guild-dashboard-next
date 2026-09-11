import { redirect } from "next/navigation";
import { requireAdmin } from "@/lib/auth";
import { getAllPlayers } from "@/lib/queries";
import RbPurchaseCalculator from "@/components/admin/RbPurchaseCalculator";

/** Минимальная посещаемость Мини-РБ, с которой игрок участвует в дележе РБ опыта. */
const MIN_MINI_RB_PCT = 20;

export default async function RbPurchasePage() {
  const admin = await requireAdmin();
  if (!admin) redirect("/dashboard");

  const players = await getAllPlayers();

  // В покупку РБ попадают только те, кто реально ходит на Мини-РБ: игроки
  // ниже порога в список не подставляются, чтобы их нельзя было отметить.
  const eligible = players.filter((p) => p.attendancePctMiniRb >= MIN_MINI_RB_PCT);

  return (
    <RbPurchaseCalculator
      players={eligible.map((p) => ({
        id: p.id,
        name: p.name,
        role: p.role,
        attendancePct: p.attendancePctMiniRb,
        salaryCoefficient: p.salaryCoefficient,
      }))}
    />
  );
}
