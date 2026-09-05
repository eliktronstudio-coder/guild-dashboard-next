"use client";

import {
  AreaChart,
  Area,
  Line,
  Legend,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import EmptyState from "@/components/EmptyState";

const numberFmt = new Intl.NumberFormat("ru-RU");

export type TreasuryChartPoint = {
  date: string;
  gold: number;
  goldMiniRb?: number;
  goldPrime?: number;
  /** true — в этот день была операция с казной (пополнение/списание). */
  hasDeposit?: boolean;
};

const seriesLabel: Record<string, string> = {
  gold: "Казна",
  goldMiniRb: "Мини-РБ",
  goldPrime: "Прайм",
};

/** Яркая точка — был приток/списание в этот день, тусклая — операций не было. */
function depositDot(props: { cx?: number; cy?: number; index?: number; payload?: TreasuryChartPoint }) {
  const { cx, cy, index, payload } = props;
  if (cx === undefined || cy === undefined) return <g key={index} />;
  return payload?.hasDeposit ? (
    <circle key={index} cx={cx} cy={cy} r={4} fill="var(--accent-bright)" stroke="var(--surface)" strokeWidth={2} />
  ) : (
    <circle key={index} cx={cx} cy={cy} r={2} fill="var(--muted-2)" fillOpacity={0.5} />
  );
}

export default function TreasuryChart({ data }: { data: TreasuryChartPoint[] }) {
  if (data.length === 0) {
    return <EmptyState />;
  }

  const hasCategories = data[0].goldMiniRb !== undefined || data[0].goldPrime !== undefined;

  return (
    <div className="min-w-0">
      <ResponsiveContainer width="100%" height={260}>
        <AreaChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
          <defs>
            <linearGradient id="goldFill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="var(--accent)" stopOpacity={0.35} />
              <stop offset="100%" stopColor="var(--accent)" stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid stroke="var(--border)" strokeDasharray="3 3" vertical={false} />
          <XAxis
            dataKey="date"
            stroke="var(--muted)"
            tick={{ fontSize: 11, fill: "var(--muted)" }}
            tickLine={false}
            axisLine={{ stroke: "var(--border)" }}
          />
          <YAxis
            stroke="var(--muted)"
            tick={{ fontSize: 11, fill: "var(--muted)" }}
            tickLine={false}
            axisLine={false}
            tickFormatter={(v) => numberFmt.format(Number(v))}
            width={64}
          />
          <Tooltip
            contentStyle={{
              background: "var(--surface-2)",
              border: "1px solid var(--border)",
              borderRadius: 8,
              fontSize: 12,
            }}
            labelStyle={{ color: "var(--foreground)" }}
            formatter={(value, name) => [
              `${numberFmt.format(Number(value))} золота`,
              seriesLabel[String(name)] ?? String(name),
            ]}
            labelFormatter={(label, payload) => {
              const point = payload?.[0]?.payload as TreasuryChartPoint | undefined;
              const suffix = point?.hasDeposit ? " — было пополнение" : " — без операций";
              return `${label}${suffix}`;
            }}
          />
          {hasCategories && (
            <Legend
              formatter={(value) => seriesLabel[value] ?? value}
              wrapperStyle={{ fontSize: 11, color: "var(--muted)" }}
            />
          )}
          <Area
            type="monotone"
            dataKey="gold"
            name="gold"
            stroke="var(--accent)"
            strokeWidth={2}
            fill="url(#goldFill)"
            dot={depositDot}
            activeDot={{ r: 5, fill: "var(--accent-bright)", stroke: "var(--surface)", strokeWidth: 2 }}
          />
          {hasCategories && (
            <Line
              type="monotone"
              dataKey="goldMiniRb"
              name="goldMiniRb"
              stroke="var(--info)"
              strokeWidth={2}
              dot={false}
              activeDot={{ r: 4, fill: "var(--info)", stroke: "var(--surface)", strokeWidth: 2 }}
            />
          )}
          {hasCategories && (
            <Line
              type="monotone"
              dataKey="goldPrime"
              name="goldPrime"
              stroke="var(--jade)"
              strokeWidth={2}
              dot={false}
              activeDot={{ r: 4, fill: "var(--jade)", stroke: "var(--surface)", strokeWidth: 2 }}
            />
          )}
        </AreaChart>
      </ResponsiveContainer>
      <div className="mt-1 flex items-center gap-3 text-[11px] text-muted">
        <span className="flex items-center gap-1">
          <span className="inline-block h-2 w-2 rounded-full" style={{ background: "var(--accent-bright)" }} />
          было пополнение
        </span>
        <span className="flex items-center gap-1">
          <span className="inline-block h-1.5 w-1.5 rounded-full opacity-50" style={{ background: "var(--muted-2)" }} />
          без операций
        </span>
      </div>
    </div>
  );
}
