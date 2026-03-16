"use client";

import { useState } from "react";
import { ArrowUp, ArrowDown, ArrowUpDown } from "lucide-react";

interface SymbolRow {
  ticker: string;
  total_trades: number;
  winning_trades: number;
  losing_trades: number;
  total_pnl: number;
  avg_pnl: number | null;
  win_rate: number | null;
}

type SortKey = keyof SymbolRow;

export default function SymbolTable({ data }: { data: SymbolRow[] }) {
  const [sortKey, setSortKey] = useState<SortKey>("total_pnl");
  const [sortAsc, setSortAsc] = useState(false);

  const handleSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortAsc(!sortAsc);
    } else {
      setSortKey(key);
      setSortAsc(false);
    }
  };

  const sorted = [...data].sort((a, b) => {
    const av = a[sortKey] ?? -Infinity;
    const bv = b[sortKey] ?? -Infinity;
    if (typeof av === "string" && typeof bv === "string") {
      return sortAsc ? av.localeCompare(bv) : bv.localeCompare(av);
    }
    return sortAsc ? Number(av) - Number(bv) : Number(bv) - Number(av);
  });

  const SortIcon = ({ col }: { col: SortKey }) => {
    if (sortKey !== col) return <ArrowUpDown className="w-3 h-3 text-slate-600" />;
    return sortAsc ? (
      <ArrowUp className="w-3 h-3 text-amber-500" />
    ) : (
      <ArrowDown className="w-3 h-3 text-amber-500" />
    );
  };

  const headers: { key: SortKey; label: string }[] = [
    { key: "ticker", label: "Símbolo" },
    { key: "winning_trades", label: "Ganados" },
    { key: "losing_trades", label: "Perdidos" },
    { key: "total_pnl", label: "PnL Total" },
    { key: "avg_pnl", label: "PnL Prom." },
    { key: "win_rate", label: "Win Rate" },
  ];

  return (
    <>
      {data.length === 0 ? (
        <p className="text-slate-600 text-sm text-center py-10 px-5 bg-slate-900/40 rounded-xl border border-white/5">Sin datos de operaciones.</p>
      ) : (
        <div className="w-full">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-white/5">
                {headers.map(({ key, label }) => (
                  <th
                    key={key}
                    className="px-4 py-3 text-left cursor-pointer hover:bg-white/5 transition-colors select-none"
                    onClick={() => handleSort(key)}
                  >
                    <div className="flex items-center gap-1 text-slate-500 font-bold uppercase tracking-wider text-[10px]">
                      {label}
                      <SortIcon col={key} />
                    </div>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {sorted.map((row) => {
                const isProfit = row.total_pnl > 0;
                return (
                  <tr
                    key={row.ticker}
                    className={`border-b border-white/5 last:border-0 transition-colors hover:bg-white/5 ${
                      isProfit ? "hover:bg-emerald-500/5" : "hover:bg-red-500/5"
                    }`}
                  >
                    <td className="px-4 py-3 font-bold text-white">{row.ticker}</td>
                    <td className="px-4 py-3 font-semibold text-emerald-400">{row.winning_trades}</td>
                    <td className="px-4 py-3 font-semibold text-red-400">{row.losing_trades}</td>
                    <td
                      className={`px-4 py-3 font-bold ${
                        isProfit ? "text-emerald-400" : "text-red-400"
                      }`}
                    >
                      {isProfit ? "+" : ""}
                      {row.total_pnl.toFixed(2)}
                    </td>
                    <td
                      className={`px-4 py-3 ${
                        row.avg_pnl === null
                          ? "text-slate-600"
                          : row.avg_pnl >= 0
                          ? "text-emerald-400"
                          : "text-red-400"
                      }`}
                    >
                      {row.avg_pnl !== null
                        ? `${row.avg_pnl >= 0 ? "+" : ""}${row.avg_pnl.toFixed(2)}`
                        : "—"}
                    </td>
                    <td className="px-4 py-3 text-slate-300">
                      {row.win_rate !== null ? `${row.win_rate.toFixed(1)}%` : "—"}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}
