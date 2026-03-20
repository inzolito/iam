"use client";

import { TrendingUp, TrendingDown, Minus } from "lucide-react";
import { useTheme } from "../../contexts/ThemeContext";

interface EquityPoint {
  date: string;
  balance: number;
  daily_pl: number;
}

interface Props {
  currentBalance?: number | null;
  netProfit: number;
  totalTrades: number;
  currency?: string;
  accountName?: string;
  equityCurve: EquityPoint[];
  liveEquity?: number | null;
}

function Sparkline({ data, positive }: { data: number[]; positive: boolean }) {
  if (data.length < 2) return null;

  const W = 200;
  const H = 56;
  const pad = 4;

  const min = Math.min(...data);
  const max = Math.max(...data);
  const range = max - min || 1;

  const pts: [number, number][] = data.map((v, i) => [
    pad + (i / (data.length - 1)) * (W - pad * 2),
    pad + (1 - (v - min) / range) * (H - pad * 2),
  ]);

  let linePath = `M ${pts[0][0].toFixed(1)},${pts[0][1].toFixed(1)}`;
  for (let i = 1; i < pts.length; i++) {
    const cpX = ((pts[i - 1][0] + pts[i][0]) / 2).toFixed(1);
    linePath += ` C ${cpX},${pts[i - 1][1].toFixed(1)} ${cpX},${pts[i][1].toFixed(1)} ${pts[i][0].toFixed(1)},${pts[i][1].toFixed(1)}`;
  }

  const last = pts[pts.length - 1];
  const fillPath = `${linePath} L ${last[0].toFixed(1)},${H} L ${pad},${H} Z`;

  const stroke = positive ? "#10b981" : "#f43f5e";
  const fill   = positive ? "rgba(16,185,129,0.08)" : "rgba(244,63,94,0.08)";

  return (
    <svg
      viewBox={`0 0 ${W} ${H}`}
      width={W}
      height={H}
      className="opacity-80"
      preserveAspectRatio="none"
    >
      <path d={fillPath} fill={fill} />
      <path d={linePath} fill="none" stroke={stroke} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
      <circle cx={last[0].toFixed(1)} cy={last[1].toFixed(1)} r="3" fill={stroke} />
    </svg>
  );
}

function fmtBalance(value: number | null, currency: string) {
  if (value === null) return "—";
  const abs = Math.abs(value);
  if (abs >= 1_000_000) return `${(value / 1_000_000).toFixed(2)}M`;
  if (abs >= 1_000) {
    const parts = abs.toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ",");
    return value < 0 ? `-${parts}` : parts;
  }
  return value.toFixed(2);
}

export default function BalanceHero({
  currentBalance = null,
  netProfit,
  totalTrades,
  currency = "USD",
  accountName,
  equityCurve,
  liveEquity = null,
}: Props) {
  const lastEquityBalance = equityCurve.length > 0
    ? equityCurve[equityCurve.length - 1].balance
    : null;

  // Priority: live equity from MetaAPI > current balance from DB > last equity curve point
  const displayValue = liveEquity !== null
    ? liveEquity
    : currentBalance ?? lastEquityBalance ?? null;

  const isLive = liveEquity !== null;
  const isPositive = netProfit > 0;
  const isNegative = netProfit < 0;

  // Use first equity curve point as period start to compute return %
  const periodStart = equityCurve.length > 0
    ? equityCurve[0].balance - equityCurve[0].daily_pl
    : null;
  const pct = periodStart != null && periodStart > 0
    ? (netProfit / periodStart) * 100
    : null;

  const sparkData = equityCurve.map((p) => p.balance);

  const sinceDate = equityCurve.length > 0
    ? new Date(equityCurve[0].date).toLocaleDateString("es-ES", { day: "numeric", month: "short", year: "numeric" })
    : null;

  const { theme } = useTheme();
  const TrendIcon = isPositive ? TrendingUp : isNegative ? TrendingDown : Minus;
  const trendColor = isPositive ? "text-emerald-400" : isNegative ? "text-red-400" : "text-slate-400";
  const glowColor = isPositive ? "rgba(16,185,129,0.12)" : isNegative ? "rgba(244,63,94,0.08)" : "rgba(255,255,255,0.04)";
  const borderColorClass = isPositive ? "border-emerald-500/20" : isNegative ? "border-red-500/15" : "border-white/5";
  const bgClass = theme === "light" ? "bg-white" : "bg-slate-950";

  return (
    <div
      className={`relative ${bgClass} rounded-2xl overflow-hidden p-4 md:p-5 border ${borderColorClass}`}
      style={{
        backgroundImage: `radial-gradient(ellipse 60% 100% at 10% 50%, ${glowColor}, transparent 70%)`,
      }}
    >
      {/* Grid texture */}
      <div
        className="absolute inset-0 opacity-[0.015] pointer-events-none"
        style={{
          backgroundImage: "repeating-linear-gradient(0deg,transparent,transparent 39px,rgba(255,255,255,1) 39px,rgba(255,255,255,1) 40px),repeating-linear-gradient(90deg,transparent,transparent 39px,rgba(255,255,255,1) 39px,rgba(255,255,255,1) 40px)",
        }}
      />

      <div className="relative flex items-center justify-between gap-6">
        {/* Left */}
        <div className="flex flex-col gap-3 min-w-0">
          {/* Label row */}
          <div className="flex items-center gap-2">
            <p className="text-[10px] font-bold uppercase tracking-[0.25em] text-slate-500">
              {isLive ? "Patrimonio (Equity)" : "Balance Actual"}
            </p>
            {isLive && (
              <span className="flex items-center gap-1 text-[9px] font-bold uppercase tracking-widest text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 rounded-full px-2 py-0.5">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                En vivo
              </span>
            )}
          </div>

          {/* Main number */}
          <div className="flex items-baseline gap-3 flex-wrap">
            {displayValue !== null ? (
              <>
                <span className={`text-2xl md:text-3xl font-bold tracking-tight tabular-nums leading-none ${theme === "light" ? "text-slate-900" : "text-white"}`}>
                  {fmtBalance(displayValue, currency)}
                </span>
                <span className="text-lg font-bold text-slate-500">{currency}</span>
              </>
            ) : (
              <span className="text-2xl md:text-3xl font-bold text-slate-600 tracking-tight leading-none">—</span>
            )}
          </div>

          {/* Change row */}
          <div className="flex items-center gap-3 flex-wrap">
            <div className={`flex items-center gap-1.5 ${trendColor}`}>
              <TrendIcon size={15} />
              <span className="text-sm font-bold tabular-nums">
                {isPositive ? "+" : ""}{currency} {Math.abs(netProfit).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </span>
            </div>
            {pct !== null && (
              <span
                className={`text-xs font-bold px-2 py-0.5 rounded-full border ${
                  isPositive
                    ? "text-emerald-400 bg-emerald-500/10 border-emerald-500/20"
                    : isNegative
                    ? "text-red-400 bg-red-500/10 border-red-500/20"
                    : "text-slate-400 bg-slate-500/10 border-slate-500/20"
                }`}
              >
                {isPositive ? "+" : ""}{pct.toFixed(2)}%
              </span>
            )}
          </div>

          {/* Meta row */}
          <div className="flex items-center gap-4 mt-1 flex-wrap">
            {accountName && (
              <span className="text-[10px] text-slate-600 font-mono">{accountName}</span>
            )}
            {sinceDate && (
              <>
                <span className="text-slate-700">·</span>
                <span className="text-[10px] text-slate-600">Desde {sinceDate}</span>
              </>
            )}
            {totalTrades > 0 && (
              <>
                <span className="text-slate-700">·</span>
                <span className="text-[10px] text-slate-600">{totalTrades} operaciones</span>
              </>
            )}
          </div>
        </div>

        {/* Sparkline */}
        {sparkData.length >= 2 && (
          <div className="hidden sm:block flex-shrink-0 opacity-90">
            <Sparkline data={sparkData} positive={isPositive || !isNegative} />
          </div>
        )}
      </div>
    </div>
  );
}
