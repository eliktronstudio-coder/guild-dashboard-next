import clsx from "clsx";
import EmptyState from "@/components/EmptyState";
import BlurValue from "@/components/BlurValue";

const numberFmt = new Intl.NumberFormat("ru-RU");

type PlayerShare = {
  id: string;
  name: string;
  role: string;
  attendancePct: number;
  salary: number;
};

function attendanceColor(pct: number) {
  if (pct <= 20) return "text-danger";
  if (pct <= 50) return "text-amber-500";
  return "text-success";
}

export default function PayoutSummaryTable({
  players,
  totalPayout,
  isRandom = false,
}: {
  players: PlayerShare[];
  totalPayout: number;
  isRandom?: boolean;
}) {
  const rows = [...players].sort((a, b) => b.salary - a.salary);

  return (
    <div className="rounded-lg border border-border bg-surface">
      <div className="border-b border-border p-4">
        <h2 className="text-sm font-semibold">Расчёт распределения</h2>
        <p className="mt-0.5 text-xs text-muted">
          Основная казна делится между игроками по посещаемости с учётом индивидуального коэффициента.
        </p>
      </div>
      {rows.length === 0 ? (
        <EmptyState />
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border text-left text-xs uppercase tracking-wider text-muted">
                <th className="px-4 py-3 font-medium">Игрок</th>
                <th className="px-4 py-3 font-medium">Активность %</th>
                <th className="px-4 py-3 font-medium">Доля</th>
                <th className="px-4 py-3 font-medium">Выплата</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {rows.map((p) => (
                <tr key={p.id} className="row-tint transition-colors">
                  <td className="px-4 py-3">
                    <span className="font-medium">{p.name}</span>
                    <span className="ml-2 text-xs text-muted">{p.role}</span>
                  </td>
                  <td className={clsx("px-4 py-3 font-mono tabular-nums", attendanceColor(p.attendancePct))}>
                    {p.attendancePct}%
                  </td>
                  <td className="px-4 py-3 font-mono tabular-nums text-muted">
                    {totalPayout > 0 ? `${((p.salary / totalPayout) * 100).toFixed(1)}%` : "—"}
                  </td>
                  <td className="px-4 py-3 font-mono font-medium tabular-nums">
                    <BlurValue blurred={isRandom}>{numberFmt.format(p.salary)}</BlurValue>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
