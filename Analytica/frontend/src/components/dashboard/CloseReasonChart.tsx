"use client";

import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer, Legend } from "recharts";

interface CloseReasonChartProps {
  tp_count: number;
  sl_count: number;
  manual_count: number;
  unknown_count: number;
  manual_rate: number | null;
}

const COLORS = {
  TP: "#10b981",       // emerald
  SL: "#f43f5e",       // rose
  MANUAL: "#f59e0b",   // amber
  UNKNOWN: "#475569",  // slate
};

export default function CloseReasonChart({
  tp_count,
  sl_count,
  manual_count,
  unknown_count,
  manual_rate,
}: CloseReasonChartProps) {
  const data = [
    { name: "Take Profit", value: tp_count, key: "TP" },
    { name: "Stop Loss", value: sl_count, key: "SL" },
    { name: "Manual", value: manual_count, key: "MANUAL" },
    { name: "Desconocido", value: unknown_count, key: "UNKNOWN" },
  ].filter((d) => d.value > 0);

  const totalCounted = tp_count + sl_count + manual_count + unknown_count;

  const manualAlertColor =
    manual_rate === null
      ? "text-slate-500"
      : manual_rate > 60
      ? "text-red-400"
      : manual_rate > 40
      ? "text-orange-400"
      : "text-slate-400";

  return (
    <div className="bg-slate-900/40 border border-white/5 rounded-xl p-5 flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <p className="text-[10px] uppercase tracking-[0.2em] text-slate-500 font-bold">
          Cierre de Operaciones
        </p>
        {manual_rate !== null && (
          <span className={`text-[10px] font-bold ${manualAlertColor}`}>
            {manual_rate.toFixed(1)}% Manual
          </span>
        )}
      </div>

      {totalCounted === 0 ? (
        <p className="text-slate-600 text-sm text-center py-8">Sin datos</p>
      ) : (
        <ResponsiveContainer width="100%" height={180}>
          <PieChart>
            <Pie
              data={data}
              cx="50%"
              cy="50%"
              innerRadius={50}
              outerRadius={80}
              paddingAngle={3}
              dataKey="value"
            >
              {data.map((entry) => (
                <Cell
                  key={entry.key}
                  fill={COLORS[entry.key as keyof typeof COLORS]}
                />
              ))}
            </Pie>
            <Tooltip
              contentStyle={{
                backgroundColor: "#0f172a",
                border: "1px solid rgba(255,255,255,0.08)",
                borderRadius: "8px",
                fontSize: "11px",
                color: "#cbd5e1",
              }}
              formatter={(value: number, name: string) => [
                `${value} ops (${totalCounted > 0 ? ((value / totalCounted) * 100).toFixed(1) : 0}%)`,
                name,
              ]}
            />
            <Legend
              iconType="circle"
              iconSize={8}
              formatter={(value) => (
                <span style={{ fontSize: "10px", color: "#94a3b8" }}>{value}</span>
              )}
            />
          </PieChart>
        </ResponsiveContainer>
      )}
    </div>
  );
}
