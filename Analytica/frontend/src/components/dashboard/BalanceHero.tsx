"use client";

import { TrendingUp, TrendingDown, Minus } from "lucide-react";

interface EquityPoint {
  date: string;
  balance: number;
}

interface Props {
  balanceInitial: number;
  netProfit: number;
  totalTrades: number;
  currency?: string;
  accountName?: string;
  equityCurve: EquityPoint[];
}

function Sparkline({ data, positive }: { data: number[]; positive: boolean }) {
  if (data.length < 2) return null;

  const W = 200;
  const H = 56;
  const pad = 4;

  const min = Math.min(...data);
  const max = Math.max(...data);
  const range = max - min || 1;

  const points = data.map((v, i) => {
    const x = pad + (i / (data.length - 1)) * (W - pad * 2);
    const y = pad + (1 - (v - min) / range) * (H - pad * 2);
    return `${x.toFixed(1)},${y.toFixed(1)}`;
  });

  const stroke = positive ? "#10b981" : "#f43f5e";
  const fill = positive ? "rgba(16,185,129,0.08)" : "rgba(244,63,94,0.08)";
  const last = points[points.length - 1].split(",");

  // Close the fill path to bottom
  const fillPath = `M ${points.join(" L ")} L ${last[0]},${H} L ${pad},${H} Z`;
  const linePath = `M ${points.join(" L ")}`;

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
      {/* Last point dot */}
      <circle cx={last[0]} cy={last[1]} r="3" fill={stroke} />
    </svg>
  );
}

function fmtBalance(value: number, currency: string) {
  const abs = Math.abs(value);
  if (abs >= 1_000_000) return `${(value / 1_000_000).toFixed(2)}M`;
  if (abs >= 1_000) {
    const parts = abs.toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ",");
    return value < 0 ? `-${parts}` : parts;
  }
  return value.toFixed(2);
}

export default function BalanceHero({
  balanceInitial,
  netProfit,
  totalTrades,
  currency = "USD",
  accountName,
  equityCurve,
}: Props) {
  // Use last equity curve balance (= balance_initial + cumulative_net_profit).
  // This is the most accurate source — it's recalculated server-side after each sync.
  const lastEquityBalance = equityCurve.length > 0
    ? equityCurve[equityCurve.length - 1].balance
    : null;

  const currentBalance = lastEquityBalance ?? (balanceInitial > 0 ? balanceInitial + netProfit : netProfit);

  // Reference capital for % calculation
  const capital = lastEquityBalance !== null && balanceInitial > 0
    ? balanceInitial
    : balanceInitial > 0 ? balanceInitial : null;

  const isPositive = netProfit > 0;
  const isNegative = netProfit < 0;

  const pct = capital != null && capital > 0
    ? (netProfit / capital) * 100
    : null;

  const sparkData = equityCurve.map((p) => p.balance);

  // Find first trade date
  const sinceDate = equityCurve.length > 0
    ? new Date(equityCurve[0].date).toLocaleDateString("es-ES", { day: "numeric", month: "short", year: "numeric" })
    : null;

  const TrendIcon = isPositive ? TrendingUp : isNegative ? TrendingDown : Minus;
  const trendColor = isPositive ? "text-emerald-400" : isNegative ? "text-red-400" : "text-slate-400";
  const glowColor = isPositive ? "rgba(16,185,129,0.12)" : isNegative ? "rgba(244,63,94,0.08)" : "rgba(255,255,255,0.04)";
  const borderColor = isPositive ? "rgba(16,185,129,0.2)" : isNegative ? "rgba(244,63,94,0.15)" : "rgba(255,255,255,0.05)";

  return (
    <div
      className="relative rounded-2xl overflow-hidden p-6 md:p-8"
      style={{
        background: `radial-gradient(ellipse 60% 100% at 10% 50%, ${glowColor}, transparent 70%), #0a0e1a`,
        border: `1px solid ${borderColor}`,
      }}
    >
      {/* Subtle grid texture */}
      <div
        className="absolute inset-0 opacity-[0.015] pointer-events-none"
        style={{
          backgroundImage: "repeating-linear-gradient(0deg,transparent,transparent 39px,rgba(255,255,255,1) 39px,rgba(255,255,255,1) 40px),repeating-linear-gradient(90deg,transparent,transparent 39px,rgba(255,255,255,1) 39px,rgba(255,255,255,1) 40px)",
        }}
      />

      <div className="relative flex items-center justify-between gap-6">
        {/* Left: balance info */}
        <div className="flex flex-col gap-3 min-w-0">
          <p className="text-[10px] font-bold uppercase tracking-[0.25em] text-slate-500">
            Balance Actual
          </p>

          {/* Main balance number */}
          <div className="flex items-baseline gap-3 flex-wrap">
            <span className="text-4xl md:text-5xl font-bold text-white tracking-tight tabular-nums leading-none">
              {fmtBalance(currentBalance, currency)}
            </span>
            <span className="text-lg font-bold text-slate-500">{currency}</span>
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

        {/* Right: sparkline */}
        {sparkData.length >= 2 && (
          <div className="hidden sm:block flex-shrink-0 opacity-90">
            <Sparkline data={sparkData} positive={isPositive || !isNegative} />
          </div>
        )}
      </div>
    </div>
  );
}
