import clsx from "clsx";

/**
 * Полоска процента посещаемости. Пороги те же, что и в расчёте зарплаты:
 * до 20% игрок в дележе казны не участвует вовсе, поэтому красный — это не
 * «плохо», а «в выплату не попадает».
 */
export function attendanceColor(pct: number) {
  if (pct <= 20) return { text: "text-danger", bar: "bg-danger" };
  if (pct <= 50) return { text: "text-amber-500", bar: "bg-amber-500" };
  return { text: "text-success", bar: "bg-success" };
}

export default function AttendanceBar({
  pct,
  label,
  barWidth = "w-16",
}: {
  pct: number;
  /** Однобуквенная пометка слева («П» / «М»), если полосок несколько. */
  label?: string;
  barWidth?: string;
}) {
  const color = attendanceColor(pct);
  return (
    <div className="flex items-center gap-2">
      {label ? (
        <span className="w-3 flex-shrink-0 text-[10px] font-semibold text-muted" title={label === "П" ? "Прайм" : "Мини-РБ"}>
          {label}
        </span>
      ) : null}
      <div className={clsx("h-1.5 overflow-hidden rounded-full bg-surface-2", barWidth)}>
        <div className={clsx("h-full rounded-full", color.bar)} style={{ width: `${Math.min(pct, 100)}%` }} />
      </div>
      <span className={clsx("text-xs font-medium tabular-nums", color.text)}>{pct}%</span>
    </div>
  );
}
