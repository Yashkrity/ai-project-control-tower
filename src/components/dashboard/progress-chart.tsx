"use client";

import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

export interface ProgressDatum {
  name: string;
  progress: number;
  scheduleElapsed: number;
  completed: number;
  total: number;
}

interface TooltipProps {
  active?: boolean;
  payload?: { payload: ProgressDatum }[];
}

function ProgressTooltip({ active, payload }: TooltipProps) {
  if (!active || !payload?.length) return null;
  const d = payload[0].payload;
  return (
    <div className="rounded-md border border-slate-200 bg-white px-3 py-2 text-xs shadow-md">
      <p className="font-medium text-slate-900">{d.name}</p>
      <p className="mt-1 text-slate-600">
        Progress <span className="font-semibold text-slate-900">{d.progress}%</span> ({d.completed}/{d.total} tasks)
      </p>
      <p className="text-slate-600">
        Schedule elapsed <span className="font-semibold text-slate-900">{d.scheduleElapsed}%</span>
      </p>
    </div>
  );
}

/** Single-series horizontal bar chart of task-based progress per project. */
export function ProgressChart({ data }: { data: ProgressDatum[] }) {
  const height = Math.max(160, data.length * 40 + 40);
  return (
    <div style={{ height }} className="w-full">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} layout="vertical" margin={{ top: 4, right: 16, bottom: 4, left: 0 }} barCategoryGap={10}>
          <CartesianGrid horizontal={false} stroke="#e2e8f0" />
          <XAxis
            type="number"
            domain={[0, 100]}
            ticks={[0, 25, 50, 75, 100]}
            tickFormatter={(v: number) => `${v}%`}
            tick={{ fontSize: 11, fill: "#64748b" }}
            axisLine={false}
            tickLine={false}
          />
          <YAxis
            type="category"
            dataKey="name"
            width={130}
            tick={{ fontSize: 11, fill: "#334155" }}
            axisLine={false}
            tickLine={false}
          />
          <Tooltip content={<ProgressTooltip />} cursor={{ fill: "#f1f5f9" }} />
          <Bar dataKey="progress" fill="#6366f1" radius={[0, 4, 4, 0]} maxBarSize={18} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
