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
export type AttendanceChartPoint = {
  date: string;
  count: number;
};

export default function AttendanceChart({ data }: { data: AttendanceChartPoint[] }) {
  return (
    <ResponsiveContainer width="100%" height={260}>
      <BarChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
        <CartesianGrid stroke="#232833" strokeDasharray="3 3" vertical={false} />
        <XAxis
          dataKey="date"
          stroke="#8b8f9c"
          tick={{ fontSize: 11, fill: "#8b8f9c" }}
          tickLine={false}
          axisLine={{ stroke: "#232833" }}
        />
        <YAxis
          stroke="#8b8f9c"
          tick={{ fontSize: 11, fill: "#8b8f9c" }}
          tickLine={false}
          axisLine={false}
          width={32}
          allowDecimals={false}
        />
        <Tooltip
          contentStyle={{
            background: "#161a23",
            border: "1px solid #232833",
            borderRadius: 8,
            fontSize: 12,
          }}
          labelStyle={{ color: "#e8e9ec" }}
          formatter={(value) => [`${value} участий`, "Активность"]}
        />
        <Bar dataKey="count" fill="#d6ad4f" radius={[4, 4, 0, 0]} />
      </BarChart>
    </ResponsiveContainer>
  );
}
