"use client";

import { useState, useCallback } from "react";
import { RefreshCw } from "lucide-react";
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from "recharts";

interface MonteCarloResult {
  simulations: number;
  forward_trades: number;
  percentile_5: number;
  percentile_50: number;
  percentile_95: number;
  ruin_probability: number;
  sample_paths: number[][];
}

interface Props {
  sharpe_ratio: number | null;
  sqn: number | null;
  sqn_rating: string | null;
  recovery_factor: number | null;
  z_score: number | null;
  z_interpretation: string | null;
  accountId: string;
  apiBase: string;
  currency?: string;
}

function StatKpi({ label, value, sub, color = "default" }: {
  label: string; value: string; sub?: string; color?: "green" | "red" | "amber" | "default";
}) {
  const colors = { green: "text-emerald-400", red: "text-red-400", amber: "text-amber-400", default: "text-white" };
  return (
    <div className="bg-slate-900/60 border border-white/5 rounded-xl p-4 flex flex-col gap-2">
      <p className="text-[10px] uppercase tracking-widest text-slate-500 font-bold">{label}</p>
      <p className={`text-xl font-bold ${colors[color]}`}>{value}</p>
      {sub && <p className="text-[10px] text-slate-500">{sub}</p>}
    </div>
  );
}

export default function Phase4Metrics({
  sharpe_ratio, sqn, sqn_rating, recovery_factor, z_score, z_interpretation,
  accountId, apiBase, currency = "USD",
}: Props) {
  const [mc, setMc] = useState<MonteCarloResult | null>(null);
  const [mcLoading, setMcLoading] = useState(false);

  const runMC = useCallback(async () => {
    setMcLoading(true);
    try {
      const token = localStorage.getItem("analytica_token");
      const res = await fetch(
        `${apiBase}/api/v1/trading/monte-carlo/${accountId}?simulations=1000&forward_trades=100`,
        { method: "POST", headers: { Authorization: `Bearer ${token}` } }
      );
      if (res.ok) setMc(await res.json());
    } finally {
      setMcLoading(false);
    }
  }, [accountId, apiBase]);

  const sharpeColor = sharpe_ratio == null ? "default"
    : sharpe_ratio >= 2 ? "green" : sharpe_ratio >= 1 ? "amber" : "red";
  const rfColor = recovery_factor == null ? "default"
    : recovery_factor >= 3 ? "green" : recovery_factor >= 1 ? "amber" : "red";

  // Build Monte Carlo chart data
  const mcChartData = mc ? Array.from({ length: mc.forward_trades }, (_, i) => {
    const entry: Record<string, number> = { trade: i + 1 };
    mc.sample_paths.slice(0, 50).forEach((path, pi) => {
      if (path[i] !== undefined) entry[`p${pi}`] = path[i];
    });
    return entry;
  }) : [];

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
        <StatKpi
          label="Sharpe Ratio"
          value={sharpe_ratio != null ? sharpe_ratio.toFixed(2) : "—"}
          sub={sharpe_ratio != null ? (sharpe_ratio >= 2 ? "Excelente" : sharpe_ratio >= 1 ? "Bueno" : "Pobre") : undefined}
          color={sharpeColor}
        />
        <StatKpi
          label="SQN"
          value={sqn != null ? sqn.toFixed(2) : "—"}
          sub={sqn_rating ?? undefined}
          color={sqn != null ? (sqn >= 2.5 ? "green" : sqn >= 2 ? "amber" : "red") : "default"}
        />
        <StatKpi
          label="Recovery Factor"
          value={recovery_factor != null ? recovery_factor.toFixed(2) : "—"}
          sub={recovery_factor != null ? (recovery_factor >= 3 ? "Excelente" : "> 1: Recuperable") : undefined}
          color={rfColor}
        />
        <StatKpi
          label="Z-Score"
          value={z_score != null ? z_score.toFixed(2) : "—"}
          sub={z_interpretation ?? undefined}
          color={z_score != null ? (Math.abs(z_score) < 1.96 ? "green" : "amber") : "default"}
        />
        <div className="bg-slate-900/60 border border-white/5 rounded-xl p-4 flex flex-col gap-2">
          <p className="text-[10px] uppercase tracking-widest text-slate-500 font-bold">Monte Carlo</p>
          {mc ? (
            <div className="space-y-1">
              <p className="text-[11px] text-slate-300">P50: <span className={`font-bold ${mc.percentile_50 >= 0 ? "text-emerald-400" : "text-red-400"}`}>{mc.percentile_50 >= 0 ? "+" : ""}{mc.percentile_50.toFixed(0)}</span></p>
              <p className="text-[10px] text-slate-500">Ruina: {mc.ruin_probability}%</p>
            </div>
          ) : (
            <p className="text-[10px] text-slate-600">Sin simular</p>
          )}
          <button
            onClick={runMC}
            disabled={mcLoading}
            className="flex items-center gap-1 text-[10px] text-amber-400 hover:text-amber-300 transition-colors disabled:opacity-50 mt-auto"
          >
            <RefreshCw size={10} className={mcLoading ? "animate-spin" : ""} />
            {mcLoading ? "Simulando..." : mc ? "Re-simular" : "Simular 1,000 escenarios"}
          </button>
        </div>
      </div>

      {mc && mcChartData.length > 0 && (
        <div className="bg-slate-900/60 border border-white/5 rounded-xl p-5">
          <div className="flex items-center justify-between mb-4">
            <p className="text-[10px] uppercase tracking-[0.2em] text-slate-500 font-bold">
              Monte Carlo — {mc.simulations.toLocaleString()} escenarios · {mc.forward_trades} trades
            </p>
            <div className="flex items-center gap-3 text-[10px] text-slate-500">
              <span className="text-red-400/70">P5: {mc.percentile_5 >= 0 ? "+" : ""}{mc.percentile_5.toFixed(0)}</span>
              <span className="text-amber-400/70">P50: {mc.percentile_50 >= 0 ? "+" : ""}{mc.percentile_50.toFixed(0)}</span>
              <span className="text-emerald-400/70">P95: {mc.percentile_95 >= 0 ? "+" : ""}{mc.percentile_95.toFixed(0)}</span>
              <span className="text-slate-400">Ruina: {mc.ruin_probability}%</span>
            </div>
          </div>
          <ResponsiveContainer width="100%" height={200}>
            <LineChart data={mcChartData} margin={{ top: 5, right: 5, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.03)" />
              <XAxis dataKey="trade" tick={{ fontSize: 9, fill: "#475569" }} tickLine={false} axisLine={false} />
              <YAxis tick={{ fontSize: 9, fill: "#475569" }} tickLine={false} axisLine={false} width={45}
                tickFormatter={(v) => `${v >= 0 ? "+" : ""}${v.toFixed(0)}`} />
              {mc.sample_paths.slice(0, 50).map((_, pi) => (
                <Line
                  key={pi}
                  type="monotone"
                  dataKey={`p${pi}`}
                  stroke="rgba(245,158,11,0.15)"
                  dot={false}
                  strokeWidth={1}
                  isAnimationActive={false}
                />
              ))}
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  );
}
