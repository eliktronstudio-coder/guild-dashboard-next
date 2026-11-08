"use client";
import { useState } from "react";
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
} from "recharts";
export default function AnalyticsChart({
  data,
  series,
  title,
}: {
  data: { date: string; [key: string]: number | string }[];
  series: { key: string; label: string; color: string }[];
  title: string;
}) {
  const [hidden, setHidden] = useState<string[]>([]);
  return (
    <section
      className="min-w-0 rounded-xl border border-border bg-surface p-4"
      aria-label={title}
    >
      <h2 className="mb-4 font-semibold">{title}</h2>
      <div className="mb-3 flex flex-wrap gap-2">
        {series.map((s) => (
          <button
            type="button"
            aria-pressed={!hidden.includes(s.key)}
            key={s.key}
            onClick={() =>
              setHidden((previous) =>
                previous.includes(s.key)
                  ? previous.filter((k) => k !== s.key)
                  : [...previous, s.key],
              )
            }
            className="min-h-10 rounded-lg border border-border px-3 text-xs"
            style={{ color: hidden.includes(s.key) ? "var(--muted)" : s.color }}
          >
            {s.label}
          </button>
        ))}
      </div>
      {data.length ? (
        <div className="h-64 min-w-0">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart
              data={data}
              margin={{ top: 8, right: 8, bottom: 4, left: 0 }}
            >
              <CartesianGrid stroke="var(--border)" strokeDasharray="3 3" />
              <XAxis dataKey="date" tick={{ fontSize: 10 }} minTickGap={30} />
              <YAxis width={48} tick={{ fontSize: 10 }} />
              <Tooltip
                contentStyle={{
                  background: "var(--surface-2)",
                  borderColor: "var(--border)",
                  color: "var(--foreground)",
                }}
              />
              {series.map((s) => (
                <Line
                  isAnimationActive={false}
                  hide={hidden.includes(s.key)}
                  key={s.key}
                  dataKey={s.key}
                  name={s.label}
                  stroke={s.color}
                  strokeWidth={2}
                  dot={false}
                />
              ))}
            </LineChart>
          </ResponsiveContainer>
        </div>
      ) : (
        <p className="text-sm text-muted">Нет данных</p>
      )}
    </section>
  );
}
