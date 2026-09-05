"use client";

import { LineChart, Line, Legend, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import EmptyState from "@/components/EmptyState";

export type DailyAttendancePoint = {
  date: string;
  prime: number;
  miniRb: number;
  pvp: number;
};

const seriesLabel: Record<string, string> = {
  prime: "Прайм",
  miniRb: "Мини-РБ",
  pvp: "PvP",
};

export default function DailyAttendanceChart({ data }: { data: DailyAttendancePoint[] }) {
  if (data.length === 0) {
    return <EmptyState />;
  }

  return (
    <div className="min-w-0">
      <ResponsiveContainer width="100%" height={220}>
        <LineChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
          <CartesianGrid stroke="var(--border)" strokeDasharray="3 3" vertical={false} />
          <XAxis
            dataKey="date"
            stroke="var(--muted)"
            tick={{ fontSize: 11, fill: "var(--muted)" }}
            tickLine={false}
            axisLine={{ stroke: "var(--border)" }}
            interval="preserveStartEnd"
          />
          <YAxis
            stroke="var(--muted)"
            tick={{ fontSize: 11, fill: "var(--muted)" }}
            tickLine={false}
            axisLine={false}
            width={24}
            allowDecimals={false}
            domain={[0, (max: number) => Math.max(1, max)]}
          />
          <Tooltip
            contentStyle={{
              background: "var(--surface-2)",
              border: "1px solid var(--border)",
              borderRadius: 8,
              fontSize: 12,
            }}
            labelStyle={{ color: "var(--foreground)" }}
            formatter={(value, name) => [`${value} участий`, seriesLabel[String(name)] ?? String(name)]}
          />
          <Legend
            formatter={(value) => seriesLabel[value] ?? value}
            wrapperStyle={{ fontSize: 11, color: "var(--muted)" }}
          />
          <Line
            type="monotone"
            dataKey="prime"
            name="prime"
            stroke="var(--jade)"
            strokeWidth={2}
            dot={{ r: 2, fill: "var(--jade)", strokeWidth: 0 }}
            activeDot={{ r: 4, fill: "var(--jade)", stroke: "var(--surface)", strokeWidth: 2 }}
          />
          <Line
            type="monotone"
            dataKey="miniRb"
            name="miniRb"
            stroke="var(--info)"
            strokeWidth={2}
            dot={{ r: 2, fill: "var(--info)", strokeWidth: 0 }}
            activeDot={{ r: 4, fill: "var(--info)", stroke: "var(--surface)", strokeWidth: 2 }}
          />
          <Line
            type="monotone"
            dataKey="pvp"
            name="pvp"
            stroke="var(--accent)"
            strokeWidth={2}
            dot={{ r: 2, fill: "var(--accent-bright)", strokeWidth: 0 }}
            activeDot={{ r: 4, fill: "var(--accent-bright)", stroke: "var(--surface)", strokeWidth: 2 }}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
