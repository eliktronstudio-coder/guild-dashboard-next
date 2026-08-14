"use client";

import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import type { TreasuryPoint } from "@/lib/mock-data";

const numberFmt = new Intl.NumberFormat("ru-RU");

export default function TreasuryChart({ data }: { data: TreasuryPoint[] }) {
  return (
    <ResponsiveContainer width="100%" height={260}>
      <AreaChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
        <defs>
          <linearGradient id="goldFill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#d6ad4f" stopOpacity={0.35} />
            <stop offset="100%" stopColor="#d6ad4f" stopOpacity={0} />
          </linearGradient>
          <linearGradient id="invFill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#5cc79a" stopOpacity={0.3} />
            <stop offset="100%" stopColor="#5cc79a" stopOpacity={0} />
          </linearGradient>
        </defs>
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
          tickFormatter={(v) => numberFmt.format(Number(v))}
          width={64}
        />
        <Tooltip
          contentStyle={{
            background: "#161a23",
            border: "1px solid #232833",
            borderRadius: 8,
            fontSize: 12,
          }}
          labelStyle={{ color: "#e8e9ec" }}
          formatter={(value, name) => [
            `${numberFmt.format(Number(value))} золота`,
            name === "gold" ? "Золото" : "Инвентарь",
          ]}
        />
        <Area type="monotone" dataKey="gold" stroke="#d6ad4f" strokeWidth={2} fill="url(#goldFill)" />
        <Area type="monotone" dataKey="inventory" stroke="#5cc79a" strokeWidth={2} fill="url(#invFill)" />
      </AreaChart>
    </ResponsiveContainer>
  );
}
