"use client";

import { ArrowUp, ArrowDown } from "lucide-react";

export interface Position {
  id: string;
  symbol: string;
  direction: "BUY" | "SELL";
  volume: number;
  open_price: number;
  current_price: number;
  pnl: number;
  duration: string;
  sl?: number | null;
  tp?: number | null;
}

function PriceBar({
  sl,
  tp,
  entry,
  current,
  pnl,
}: {
  sl: number;
  tp: number;
  entry: number;
  current: number;
  pnl: number;
}) {
  const lo  = Math.min(sl, tp);
  const hi  = Math.max(sl, tp);
  const rng = hi - lo || 1;

  const clamp = (v: number) => Math.max(0, Math.min(100, ((v - lo) / rng) * 100));
  const entryPct   = clamp(entry);
  const currentPct = clamp(current);
  const fillLeft   = Math.min(entryPct, currentPct);
  const fillWidth  = Math.abs(currentPct - entryPct);
  const isGain     = pnl >= 0;

  const fmtP = (v: number) => v < 10 ? v.toFixed(5) : v.toFixed(2);

  return (
    <div className="mt-1.5 space-y-1">
      <div className="flex justify-between text-[9px] text-slate-600 font-mono">
        <span>SL {fmtP(sl)}</span>
        <span className="text-slate-500">{fmtP(entry)}</span>
        <span>TP {fmtP(tp)}</span>
      </div>
      <div className="relative h-[8px] bg-slate-800 rounded-full overflow-hidden">
        {/* Fill */}
        <div
          className="absolute top-0 h-full rounded-full transition-all duration-1000"
          style={{
            left:  `${fillLeft}%`,
            width: `${fillWidth}%`,
            backgroundColor: isGain ? "rgba(16,185,129,0.7)" : "rgba(244,63,94,0.7)",
          }}
        />
        {/* Entry marker */}
        <div
          className="absolute top-0 w-px h-full bg-slate-400"
          style={{ left: `${entryPct}%` }}
        />
        {/* Current marker */}
        <div
          className="absolute top-0 w-1 h-full rounded-full"
          style={{
            left:            `calc(${currentPct}% - 2px)`,
            backgroundColor: isGain ? "#10b981" : "#f43f5e",
          }}
        />
      </div>
    </div>
  );
}

export default function OpenPositions({
  positions,
  currency = "USD",
}: {
  positions: Position[];
  currency?: string;
}) {
  if (positions.length === 0) return null;

  const totalPnl = positions.reduce((s, p) => s + p.pnl, 0);

  return (
    <div className="bg-slate-900/60 border border-white/5 rounded-xl overflow-hidden">
      <div className="px-5 py-3 border-b border-white/5 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse" />
          <p className="text-[10px] uppercase tracking-[0.2em] text-slate-500 font-bold">
            Posiciones Abiertas
          </p>
          <span className="text-[10px] font-bold text-slate-600 bg-slate-800 rounded-full px-2 py-0.5">
            {positions.length}
          </span>
        </div>
        <span className={`text-xs font-bold tabular-nums ${totalPnl >= 0 ? "text-emerald-400" : "text-red-400"}`}>
          {totalPnl >= 0 ? "+" : ""}{currency} {Math.abs(totalPnl).toFixed(2)}
        </span>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-xs">
          <thead>
            <tr className="border-b border-white/5">
              {["Símbolo", "Dir.", "Lote", "Entrada", "Actual", "SL", "TP", "PnL Flotante", "Tiempo"].map((h) => (
                <th key={h} className="px-4 py-2.5 text-left text-[9px] font-bold uppercase tracking-wider text-slate-500 whitespace-nowrap">
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {positions.map((pos) => {
              const isGain   = pos.pnl >= 0;
              const fmtPrice = (v: number) => v < 10 ? v.toFixed(5) : v.toFixed(2);
              const pnlPct   = pos.open_price > 0
                ? ((pos.current_price - pos.open_price) / pos.open_price * 100 * (pos.direction === "BUY" ? 1 : -1))
                : null;
              const showBar  = pos.sl != null && pos.tp != null;

              return (
                <tr key={pos.id} className="border-b border-white/5 last:border-0 hover:bg-white/2 transition-colors">
                  <td className="px-4 py-2.5">
                    <div>
                      <span className="font-bold text-white">{pos.symbol}</span>
                      {showBar && (
                        <PriceBar
                          sl={pos.sl!}
                          tp={pos.tp!}
                          entry={pos.open_price}
                          current={pos.current_price}
                          pnl={pos.pnl}
                        />
                      )}
                    </div>
                  </td>
                  <td className="px-4 py-2.5">
                    <span className={`flex items-center gap-1 font-bold ${pos.direction === "BUY" ? "text-emerald-400" : "text-red-400"}`}>
                      {pos.direction === "BUY" ? <ArrowUp size={10} /> : <ArrowDown size={10} />}
                      {pos.direction === "BUY" ? "COMPRA" : "VENTA"}
                    </span>
                  </td>
                  <td className="px-4 py-2.5 text-slate-300 tabular-nums">{pos.volume.toFixed(2)}</td>
                  <td className="px-4 py-2.5 text-slate-400 tabular-nums font-mono text-[11px]">{fmtPrice(pos.open_price)}</td>
                  <td className="px-4 py-2.5 text-slate-300 tabular-nums font-mono text-[11px]">{fmtPrice(pos.current_price)}</td>
                  <td className="px-4 py-2.5 text-slate-500 tabular-nums font-mono text-[11px]">
                    {pos.sl != null ? fmtPrice(pos.sl) : "—"}
                  </td>
                  <td className="px-4 py-2.5 text-slate-500 tabular-nums font-mono text-[11px]">
                    {pos.tp != null ? fmtPrice(pos.tp) : "—"}
                  </td>
                  <td className="px-4 py-2.5">
                    <span className={`font-bold tabular-nums ${isGain ? "text-emerald-400" : "text-red-400"}`}>
                      {isGain ? "+" : ""}{currency} {pos.pnl.toFixed(2)}
                    </span>
                    {pnlPct !== null && (
                      <span className={`block text-[10px] tabular-nums ${isGain ? "text-emerald-500/70" : "text-red-500/70"}`}>
                        {isGain ? "+" : ""}{pnlPct.toFixed(2)}%
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-2.5 text-slate-500 text-[11px]">{pos.duration}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
