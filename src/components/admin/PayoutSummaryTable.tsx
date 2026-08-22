import clsx from "clsx";
import EmptyState from "@/components/EmptyState";
import BlurValue from "@/components/BlurValue";

const numberFmt = new Intl.NumberFormat("ru-RU");

type PlayerShare = {
  id: string;
  name: string;
  role: string;
  attendancePctPrime: number;
  attendancePctMiniRb: number;
  salary: number;
  salaryPrime: number;
  salaryMiniRb: number;
};

function attendanceColor(pct: number) {
  if (pct <= 20) return { text: "text-danger", bar: "bg-danger" };
  if (pct <= 50) return { text: "text-amber-500", bar: "bg-amber-500" };
  return { text: "text-success", bar: "bg-success" };
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
                <th className="px-4 py-3 font-medium">Посещаемость</th>
                <th className="px-4 py-3 font-medium">Доля</th>
                <th className="px-4 py-3 font-medium">Выплата</th>
                <th className="px-4 py-3 font-medium">Зарплата</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {rows.map((p) => (
                <tr key={p.id} className="row-tint transition-colors">
                  <td className="px-4 py-3">
                    <span className="font-medium">{p.name}</span>
                    <span className="ml-2 text-xs text-muted">{p.role}</span>
                  </td>
                  <td className="px-4 py-3">
                    <BlurValue blurred={isRandom}>
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <span className="w-3 flex-shrink-0 text-[10px] font-semibold text-muted" title="Прайм">
                            П
                          </span>
                          <div className="h-1.5 w-16 overflow-hidden rounded-full bg-surface-2">
                            <div
                              className={clsx("h-full rounded-full", attendanceColor(p.attendancePctPrime).bar)}
                              style={{ width: `${Math.min(p.attendancePctPrime, 100)}%` }}
                            />
                          </div>
                          <span className={clsx("text-xs font-medium", attendanceColor(p.attendancePctPrime).text)}>
                            {p.attendancePctPrime}%
                          </span>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="w-3 flex-shrink-0 text-[10px] font-semibold text-muted" title="Мини-РБ">
                            М
                          </span>
                          <div className="h-1.5 w-16 overflow-hidden rounded-full bg-surface-2">
                            <div
                              className={clsx("h-full rounded-full", attendanceColor(p.attendancePctMiniRb).bar)}
                              style={{ width: `${Math.min(p.attendancePctMiniRb, 100)}%` }}
                            />
                          </div>
                          <span className={clsx("text-xs font-medium", attendanceColor(p.attendancePctMiniRb).text)}>
                            {p.attendancePctMiniRb}%
                          </span>
                        </div>
                      </div>
                    </BlurValue>
                  </td>
                  <td className="px-4 py-3 font-mono tabular-nums text-muted">
                    {totalPayout > 0 ? `${((p.salary / totalPayout) * 100).toFixed(1)}%` : "—"}
                  </td>
                  <td className="px-4 py-3 font-mono font-medium tabular-nums">
                    <BlurValue blurred={isRandom}>{numberFmt.format(p.salary)}</BlurValue>
                  </td>
                  <td className="px-4 py-3">
                    <BlurValue blurred={isRandom}>
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <span className="w-3 flex-shrink-0 text-[10px] font-semibold text-muted" title="Прайм">
                            П
                          </span>
                          <span className="font-medium tabular-nums">{numberFmt.format(p.salaryPrime)}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="w-3 flex-shrink-0 text-[10px] font-semibold text-muted" title="Мини-РБ">
                            М
                          </span>
                          <span className="font-medium tabular-nums">{numberFmt.format(p.salaryMiniRb)}</span>
                        </div>
                      </div>
                    </BlurValue>
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
