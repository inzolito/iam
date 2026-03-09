"use client";

interface SymbolRow {
  ticker: string;
  asset_class: string;
  total_trades: number;
  total_pnl: number | null;
  win_rate: number | null;
}

export default function AssetRanking({
  data,
  currency = "USD",
}: {
  data: SymbolRow[];
  currency?: string;
}) {
  if (data.length === 0) return null;

  const sorted = [...data].sort((a, b) => (b.total_pnl ?? 0) - (a.total_pnl ?? 0));
  const top5 = sorted.slice(0, 5);
  const bottom5 = sorted.slice(-5).reverse();
  const maxAbs = Math.max(...sorted.map((r) => Math.abs(r.total_pnl ?? 0)), 1);

  const Row = ({ row, positive }: { row: SymbolRow; positive: boolean }) => {
    const pnl = row.total_pnl ?? 0;
    const bar = Math.abs(pnl) / maxAbs;
    return (
      <div className="flex items-center gap-3 py-1.5">
        <span className="w-20 text-xs font-bold text-white shrink-0">{row.ticker}</span>
        <div className="flex-1 bg-slate-800 rounded-full h-1.5 overflow-hidden">
          <div
            className={`h-full rounded-full ${positive ? "bg-emerald-500" : "bg-red-500"}`}
            style={{ width: `${bar * 100}%` }}
          />
        </div>
        <span className={`text-xs font-bold w-24 text-right shrink-0 ${positive ? "text-emerald-400" : "text-red-400"}`}>
          {pnl >= 0 ? "+" : ""}{currency} {Math.abs(pnl).toFixed(2)}
        </span>
      </div>
    );
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
      <div className="bg-slate-900/60 border border-white/5 rounded-xl p-5">
        <p className="text-[10px] uppercase tracking-[0.2em] text-slate-500 font-bold mb-4">
          🏆 Top Activos
        </p>
        <div className="space-y-1">
          {top5.map((r) => <Row key={r.ticker} row={r} positive={true} />)}
        </div>
      </div>
      <div className="bg-slate-900/60 border border-white/5 rounded-xl p-5">
        <p className="text-[10px] uppercase tracking-[0.2em] text-slate-500 font-bold mb-4">
          ⚠️ Bottom Activos
        </p>
        <div className="space-y-1">
          {bottom5.map((r) => <Row key={r.ticker} row={r} positive={false} />)}
        </div>
      </div>
    </div>
  );
}
