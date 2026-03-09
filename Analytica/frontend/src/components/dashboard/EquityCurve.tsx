"use client";

import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ReferenceLine,
  ResponsiveContainer,
} from "recharts";

interface EquityCurvePoint {
  date: string;
  balance: number;
  daily_pl: number;
  trades_count: number;
}

interface EquityCurveProps {
  data: EquityCurvePoint[];
  balanceInitial: number;
  currency?: string;
}

function formatBalance(value: number, currency: string) {
  return `${currency} ${value.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export default function EquityCurve({ data, balanceInitial, currency = "USD" }: EquityCurveProps) {
  const lastBalance = data.length > 0 ? data[data.length - 1].balance : balanceInitial;
  const overallPnl = lastBalance - balanceInitial;
  const isPositive = overallPnl >= 0;

  const strokeColor = isPositive ? "#10b981" : "#f43f5e";
  const gradientId = "equityGradient";

  return (
    <div className="bg-slate-900/60 border border-white/5 rounded-xl p-5 flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <p className="text-[10px] uppercase tracking-[0.2em] text-slate-500 font-bold">
          Curva de Equity
        </p>
        <span
          className={`text-sm font-bold ${isPositive ? "text-emerald-400" : "text-red-400"}`}
        >
          {isPositive ? "+" : ""}
          {formatBalance(overallPnl, currency)}
        </span>
      </div>

      {data.length === 0 ? (
        <p className="text-slate-600 text-sm text-center py-12">
          Sin datos. Los snapshots se generan automáticamente con la ingesta de trades.
        </p>
      ) : (
        <ResponsiveContainer width="100%" height={220}>
          <AreaChart data={data} margin={{ top: 5, right: 5, left: 0, bottom: 0 }}>
            <defs>
              <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor={strokeColor} stopOpacity={0.2} />
                <stop offset="95%" stopColor={strokeColor} stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" />
            <XAxis
              dataKey="date"
              tick={{ fontSize: 10, fill: "#475569" }}
              tickLine={false}
              axisLine={false}
              tickFormatter={(v: string) => v.slice(5)} // MM-DD
            />
            <YAxis
              tick={{ fontSize: 10, fill: "#475569" }}
              tickLine={false}
              axisLine={false}
              tickFormatter={(v: number) => `${(v / 1000).toFixed(1)}k`}
              width={42}
            />
            <Tooltip
              contentStyle={{
                backgroundColor: "#0f172a",
                border: "1px solid rgba(255,255,255,0.08)",
                borderRadius: "8px",
                fontSize: "11px",
                color: "#cbd5e1",
              }}
              formatter={(value: number, name: string) => {
                if (name === "balance") return [formatBalance(value, currency), "Balance"];
                if (name === "daily_pl") {
                  const color = value >= 0 ? "#10b981" : "#f43f5e";
                  return [
                    <span key="pl" style={{ color }}>
                      {value >= 0 ? "+" : ""}
                      {formatBalance(value, currency)}
                    </span>,
                    "PnL Día",
                  ];
                }
                return [value, name];
              }}
              labelFormatter={(label: string) => `Fecha: ${label}`}
            />
            <ReferenceLine
              y={balanceInitial}
              stroke="rgba(255,255,255,0.15)"
              strokeDasharray="4 4"
              label={{ value: "Inicial", fill: "#475569", fontSize: 10, position: "insideTopLeft" }}
            />
            <Area
              type="monotone"
              dataKey="balance"
              stroke={strokeColor}
              strokeWidth={2}
              fill={`url(#${gradientId})`}
              dot={false}
              activeDot={{ r: 4, fill: strokeColor }}
            />
          </AreaChart>
        </ResponsiveContainer>
      )}
    </div>
  );
}
