"use client";

import { ArrowUp, ArrowDown } from "lucide-react";

interface Position {
  id: string;
  symbol: string;
  direction: "BUY" | "SELL";
  volume: number;
  open_price: number;
  current_price: number;
  pnl: number;
  duration: string;
}

export default function OpenPositions({
  positions,
  currency = "USD",
}: {
  positions: Position[];
  currency?: string;
}) {
  if (positions.length === 0) return null;

  const totalPnl = positions.reduce((sum, p) => sum + p.pnl, 0);

  return (
    <div className="bg-slate-900/60 border border-white/5 rounded-xl overflow-hidden">
      <div className="px-5 py-4 border-b border-white/5 flex items-center justify-between">
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
          {totalPnl >= 0 ? "+" : ""}{currency} {Math.abs(totalPnl).toFixed(2)} flotante
        </span>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-xs">
          <thead>
            <tr className="border-b border-white/5">
              {["Símbolo", "Dir.", "Volumen", "Entrada", "Actual", "PNL Flotante", "Abierto hace"].map((h) => (
                <th
                  key={h}
                  className="px-4 py-3 text-left text-[10px] font-bold uppercase tracking-wider text-slate-500"
                >
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {positions.map((pos) => {
              const isProfit = pos.pnl >= 0;
              return (
                <tr
                  key={pos.id}
                  className={`border-b border-white/5 last:border-0 transition-colors ${
                    isProfit
                      ? "hover:bg-emerald-500/5"
                      : "hover:bg-red-500/5"
                  }`}
                >
                  <td className="px-4 py-3 font-bold text-white">{pos.symbol}</td>
                  <td className="px-4 py-3">
                    <span className={`flex items-center gap-1 font-bold ${pos.direction === "BUY" ? "text-emerald-400" : "text-red-400"}`}>
                      {pos.direction === "BUY"
                        ? <ArrowUp size={11} />
                        : <ArrowDown size={11} />}
                      {pos.direction}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-slate-300 tabular-nums">{pos.volume.toFixed(2)}</td>
                  <td className="px-4 py-3 text-slate-400 tabular-nums font-mono text-[11px]">
                    {pos.open_price.toFixed(pos.open_price < 10 ? 5 : 2)}
                  </td>
                  <td className="px-4 py-3 text-slate-300 tabular-nums font-mono text-[11px]">
                    {pos.current_price.toFixed(pos.current_price < 10 ? 5 : 2)}
                  </td>
                  <td className={`px-4 py-3 font-bold tabular-nums ${isProfit ? "text-emerald-400" : "text-red-400"}`}>
                    {isProfit ? "+" : ""}{currency} {pos.pnl.toFixed(2)}
                  </td>
                  <td className="px-4 py-3 text-slate-500 tabular-nums">{pos.duration}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
