"use client";

import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import EmptyState from "@/components/EmptyState";

export type DailyAttendancePoint = {
  date: string;
  /** null — в этот день не было участия, график рисует разрыв, а не 0. */
  count: number | null;
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
            formatter={(value) => [value === null ? "не был" : `${value} участий`, "Активность"]}
          />
          <Line
            type="monotone"
            dataKey="count"
            stroke="var(--accent)"
            strokeWidth={2}
            connectNulls={false}
            dot={{ r: 3, fill: "var(--accent-bright)", strokeWidth: 0 }}
            activeDot={{ r: 5, fill: "var(--accent-bright)", stroke: "var(--surface)", strokeWidth: 2 }}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
