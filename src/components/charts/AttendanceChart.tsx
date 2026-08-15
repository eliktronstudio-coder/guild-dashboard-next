"use client";

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import EmptyState from "@/components/EmptyState";

export type AttendanceChartPoint = {
  date: string;
  count: number;
};

export default function AttendanceChart({ data }: { data: AttendanceChartPoint[] }) {
  if (data.length === 0) {
    return <EmptyState />;
  }

  return (
    <div className="min-w-0">
      <ResponsiveContainer width="100%" height={260}>
        <BarChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
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
            width={32}
            allowDecimals={false}
          />
          <Tooltip
            contentStyle={{
              background: "var(--surface-2)",
              border: "1px solid var(--border)",
              borderRadius: 8,
              fontSize: 12,
            }}
            labelStyle={{ color: "var(--foreground)" }}
            formatter={(value) => [`${value} участий`, "Активность"]}
          />
          <Bar dataKey="count" fill="var(--accent)" radius={[4, 4, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
