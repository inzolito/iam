"use client";

import {
  ScatterChart, Scatter, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine,
} from "recharts";

interface TradeRow {
  id: string;
  ticker: string;
  duration_hours: number;
  net_profit: number;
  close_reason: string | null;
}

export default function HoldingTimeScatter({ data, currency = "USD" }: { data: TradeRow[]; currency?: string }) {
  if (!data.length) return null;

  const wins = data.filter((t) => t.net_profit > 0);
  const losses = data.filter((t) => t.net_profit <= 0);

  return (
    <div className="flex flex-col h-full">
      <p className="text-[10px] uppercase tracking-[0.2em] text-slate-500 font-bold mb-4">
        Duración vs Resultado
      </p>
      <div className="flex-1 min-h-[220px] bg-slate-900/40 rounded-xl border border-white/5 p-4">
        <ResponsiveContainer width="100%" height="100%">
          <ScatterChart margin={{ top: 5, right: 5, left: 0, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" />
            <XAxis
              dataKey="duration_hours"
              name="Duración (h)"
              tick={{ fontSize: 10, fill: "#475569" }}
              tickLine={false}
              axisLine={false}
              label={{ value: "Horas", position: "insideBottom", offset: -2, fontSize: 10, fill: "#475569" }}
            />
            <YAxis
              dataKey="net_profit"
              name="PnL"
              tick={{ fontSize: 10, fill: "#475569" }}
              tickLine={false}
              axisLine={false}
              width={35}
              tickFormatter={(v) => `${v >= 0 ? "+" : ""}${v.toFixed(0)}`}
            />
            <ReferenceLine y={0} stroke="rgba(255,255,255,0.15)" strokeDasharray="4 4" />
            <Tooltip
              contentStyle={{ backgroundColor: "#0f172a", border: "1px solid rgba(255,255,255,0.08)", borderRadius: "8px", fontSize: "11px" }}
              formatter={(value: number, name: string) => {
                if (name === "PnL") return [`${value >= 0 ? "+" : ""}${currency} ${value.toFixed(2)}`, "PnL"];
                return [`${value.toFixed(1)}h`, "Duración"];
              }}
            />
            <Scatter name="Ganadoras" data={wins} fill="#10b981" fillOpacity={0.7} r={4} />
            <Scatter name="Perdedoras" data={losses} fill="#f43f5e" fillOpacity={0.7} r={4} />
          </ScatterChart>
        </ResponsiveContainer>
      </div>
      <div className="flex items-center gap-4 mt-3">
        <div className="flex items-center gap-1.5">
          <div className="w-2.5 h-2.5 rounded-full bg-emerald-500" />
          <span className="text-[9px] text-slate-500 uppercase tracking-widest font-bold">Ganadoras</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-2.5 h-2.5 rounded-full bg-red-500" />
          <span className="text-[9px] text-slate-500 uppercase tracking-widest font-bold">Perdedoras</span>
        </div>
      </div>
    </div>
  );
}
