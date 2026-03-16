"use client";

import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell,
} from "recharts";

interface SessionRow {
  session: string;
  total_pnl: number;
  avg_pnl: number;
  win_rate: number;
  trades: number;
}

export default function SessionChart({ data, currency = "USD" }: { data: SessionRow[]; currency?: string }) {
  if (!data.length) return null;

  const best = data.reduce((a, b) => (a.total_pnl > b.total_pnl ? a : b));

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between mb-4">
        <p className="text-[10px] uppercase tracking-[0.2em] text-slate-500 font-bold">
          Rendimiento por Sesión
        </p>
        <span className="text-[10px] text-amber-400 bg-amber-500/10 border border-amber-500/20 rounded-full px-2 py-0.5 font-bold">
          Mejor: {best.session}
        </span>
      </div>

      <div className="flex-1 min-h-[200px] bg-slate-900/40 rounded-xl border border-white/5 p-4">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} margin={{ top: 5, right: 5, left: 0, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" />
            <XAxis dataKey="session" tick={{ fontSize: 10, fill: "#475569" }} tickLine={false} axisLine={false} />
            <YAxis tick={{ fontSize: 10, fill: "#475569" }} tickLine={false} axisLine={false} width={35}
              tickFormatter={(v) => `${v >= 0 ? "+" : ""}${v.toFixed(0)}`} />
            <Tooltip
              contentStyle={{ backgroundColor: "#0f172a", border: "1px solid rgba(255,255,255,0.08)", borderRadius: "8px", fontSize: "11px" }}
              formatter={(value: number, name: string) => {
                if (name === "total_pnl") return [`${value >= 0 ? "+" : ""}${currency} ${value.toFixed(2)}`, "PnL Total"];
                return [value, name];
              }}
            />
            <Bar dataKey="total_pnl" radius={[4, 4, 0, 0]}>
              {data.map((entry, i) => (
                <Cell key={i} fill={entry.total_pnl >= 0 ? "#10b981" : "#f43f5e"} fillOpacity={entry.session === best.session ? 1 : 0.6} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>

      <div className="grid grid-cols-2 gap-2 mt-3">
        {data.map((s) => (
          <div key={s.session} className="bg-slate-950/40 rounded-lg px-3 py-2 border border-white/5">
            <p className="text-[8px] text-slate-500 uppercase tracking-widest font-bold">{s.session}</p>
            <p className={`text-xs font-bold ${s.total_pnl >= 0 ? "text-emerald-400" : "text-red-400"}`}>
              {s.total_pnl >= 0 ? "+" : ""}{s.total_pnl.toFixed(2)}
            </p>
            <p className="text-[9px] text-slate-500">{s.win_rate.toFixed(0)}% WR</p>
          </div>
        ))}
      </div>
    </div>
  );
}
