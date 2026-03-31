"use client";

import { useState, useEffect, useCallback } from "react";
import { ChevronUp, ChevronDown, ChevronRight, ChevronsLeft, ChevronsRight } from "lucide-react";
import { API_BASE } from "../../config";

interface Trade {
  id: string;
  ticket: string;
  ticker: string;
  open_time: string | null;
  close_time: string | null;
  side: string;
  volume: number;
  open_price: number;
  close_price: number;
  sl: number | null;
  tp: number | null;
  net_profit: number;
  commission: number;
  swap: number;
  comment: string;
  close_reason: string;
  duration_seconds: number;
}

type Period = "today" | "yesterday" | "7d" | "30d" | "custom";

const PERIODS: { label: string; value: Period }[] = [
  { label: "Hoy",      value: "today" },
  { label: "Ayer",     value: "yesterday" },
  { label: "7 días",   value: "7d" },
  { label: "30 días",  value: "30d" },
  { label: "Custom",   value: "custom" },
];

function getPeriodDates(p: Period): { from: string | null; to: string | null } {
  const fmt = (d: Date) =>
    `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  const today = new Date();

  if (p === "today") {
    return { from: fmt(today), to: fmt(today) };
  }
  if (p === "yesterday") {
    const y = new Date(today); y.setDate(y.getDate() - 1);
    return { from: fmt(y), to: fmt(y) };
  }
  if (p === "7d") {
    const d = new Date(today); d.setDate(d.getDate() - 6);
    return { from: fmt(d), to: fmt(today) };
  }
  if (p === "30d") {
    const d = new Date(today); d.setDate(d.getDate() - 29);
    return { from: fmt(d), to: fmt(today) };
  }
  return { from: null, to: null };
}

function fmtDt(iso: string | null): string {
  if (!iso) return "—";
  const d = new Date(iso);
  return `${d.toLocaleDateString("es-ES", { day: "2-digit", month: "2-digit" })} ${d.toLocaleTimeString("es-ES", { hour: "2-digit", minute: "2-digit" })}`;
}

function fmtPrice(v: number): string {
  return v < 10 ? v.toFixed(5) : v.toFixed(2);
}

function fmtDuration(secs: number): string {
  const h = Math.floor(secs / 3600);
  const m = Math.floor((secs % 3600) / 60);
  return h > 0 ? `${h}h ${String(m).padStart(2, "0")}m` : `${m}m`;
}

type SortKey = "open_time" | "close_time" | "side" | "volume" | "open_price" | "close_price" | "net_profit";

interface TradeHistoryProps {
  accountId: string;
  currency?: string;
  dateFrom?: string | null;
  dateTo?: string | null;
}

export default function TradeHistory({ accountId, currency = "USD", dateFrom: externalFrom, dateTo: externalTo }: TradeHistoryProps) {
  const hasExternalFilter = externalFrom != null || externalTo != null;

  const [trades, setTrades]       = useState<Trade[]>([]);
  const [total, setTotal]         = useState(0);
  const [pages, setPages]         = useState(1);
  const [page, setPage]           = useState(1);
  const [loading, setLoading]     = useState(false);
  const [period, setPeriod]       = useState<Period>(hasExternalFilter ? "custom" : "today");
  const [customFrom, setCustomFrom] = useState(externalFrom ?? "");
  const [customTo, setCustomTo]   = useState(externalTo ?? "");
  const [sortBy, setSortBy]       = useState<SortKey>("close_time");
  const [sortDir, setSortDir]     = useState<"asc" | "desc">("desc");
  const [expanded, setExpanded]   = useState<string | null>(null);

  // Sync with global date filter when it changes
  useEffect(() => {
    if (externalFrom != null || externalTo != null) {
      setCustomFrom(externalFrom ?? "");
      setCustomTo(externalTo ?? "");
      setPeriod("custom");
      setPage(1);
    }
  }, [externalFrom, externalTo]);

  const dates = period === "custom"
    ? { from: customFrom || null, to: customTo || null }
    : getPeriodDates(period);

  const fetchTrades = useCallback(async () => {
    if (!accountId) return;
    setLoading(true);
    const token = localStorage.getItem("analytica_token") ?? "";
    const qs = new URLSearchParams({ page: String(page), page_size: "50", sort_by: sortBy, sort_dir: sortDir });
    if (dates.from) qs.set("date_from", dates.from);
    if (dates.to)   qs.set("date_to",   dates.to);
    try {
      const res = await fetch(`${API_BASE}/api/v1/trading/history/${accountId}?${qs}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const data = await res.json();
        setTrades(data.trades ?? []);
        setTotal(data.total ?? 0);
        setPages(data.pages ?? 1);
      }
    } catch { /* ignore */ }
    finally { setLoading(false); }
  }, [accountId, page, sortBy, sortDir, dates.from, dates.to]);

  useEffect(() => { fetchTrades(); }, [fetchTrades]);

  // Reset to page 1 on sort change
  useEffect(() => { setPage(1); }, [sortBy, sortDir]);

  const handleSort = (col: SortKey) => {
    if (sortBy === col) setSortDir((d) => (d === "desc" ? "asc" : "desc"));
    else { setSortBy(col); setSortDir("desc"); }
  };

  const SortIcon = ({ col }: { col: SortKey }) => {
    if (sortBy !== col) return <ChevronUp size={10} className="text-slate-700" />;
    return sortDir === "desc"
      ? <ChevronDown size={10} className="text-amber-400" />
      : <ChevronUp   size={10} className="text-amber-400" />;
  };

  const totalPnl = trades.reduce((s, t) => s + t.net_profit, 0);
  const avgPct   = trades.length > 0
    ? trades.reduce((s, t) => s + (t.open_price > 0 ? (t.net_profit / t.open_price) * 100 : 0), 0) / trades.length
    : 0;

  const COLS: { label: string; key?: SortKey; cls?: string }[] = [
    { label: "Apertura",  key: "open_time" },
    { label: "Cierre",    key: "close_time" },
    { label: "Símbolo" },
    { label: "Tipo",      key: "side" },
    { label: "Lote",      key: "volume",      cls: "text-right" },
    { label: "Entrada",   key: "open_price",  cls: "text-right" },
    { label: "Cierre P.", key: "close_price", cls: "text-right" },
    { label: "SL",                            cls: "text-right" },
    { label: "TP",                            cls: "text-right" },
    { label: "Resultado", key: "net_profit",  cls: "text-right" },
    { label: "%",                             cls: "text-right" },
  ];

  return (
    <div className="space-y-3">
      {/* Filters */}
      <div className="flex items-center gap-2 flex-wrap">
        {hasExternalFilter ? (
          /* Global filter is active — show date range as read-only badge */
          <div className="flex items-center gap-2">
            <span className="text-[9px] uppercase tracking-widest text-slate-600 font-bold">Filtro:</span>
            <span className="text-[10px] text-amber-400/80 border border-amber-500/20 bg-amber-500/5 rounded-lg px-2.5 py-1 font-mono">
              {customFrom || "—"} → {customTo || "—"}
            </span>
          </div>
        ) : (
          /* No global filter — show internal period chips */
          <>
            {PERIODS.map((p) => (
              <button
                key={p.value}
                onClick={() => { setPeriod(p.value); setPage(1); }}
                className={`text-[9px] uppercase tracking-widest px-3 py-1.5 rounded-lg border font-bold transition-all ${
                  period === p.value
                    ? "border-amber-500/50 bg-amber-500/8 text-amber-400"
                    : "border-white/5 bg-slate-900/40 text-slate-500 hover:text-white"
                }`}
              >
                {p.label}
              </button>
            ))}
            {period === "custom" && (
              <>
                <input type="date" value={customFrom} onChange={(e) => { setCustomFrom(e.target.value); setPage(1); }}
                  className="bg-slate-900 border border-white/8 rounded-lg px-2 py-1 text-[11px] text-slate-300 focus:outline-none focus:border-amber-500/40" />
                <span className="text-slate-600 text-xs">—</span>
                <input type="date" value={customTo} onChange={(e) => { setCustomTo(e.target.value); setPage(1); }}
                  className="bg-slate-900 border border-white/8 rounded-lg px-2 py-1 text-[11px] text-slate-300 focus:outline-none focus:border-amber-500/40" />
              </>
            )}
          </>
        )}
        {total > 0 && (
          <span className="ml-auto text-[10px] text-slate-600">{total} operaciones</span>
        )}
      </div>

      {/* Table */}
      <div className="bg-slate-900/60 border border-white/5 rounded-xl overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center py-12 gap-2">
            <div className="w-4 h-4 border-2 border-t-amber-500 border-amber-500/20 rounded-full animate-spin" />
            <span className="text-[11px] text-slate-500">Cargando...</span>
          </div>
        ) : trades.length === 0 ? (
          <div className="py-12 text-center">
            <p className="text-xs text-slate-500">Sin operaciones en este período</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-white/5">
                  {COLS.map((c) => (
                    <th
                      key={c.label}
                      onClick={() => c.key && handleSort(c.key)}
                      className={`px-3 py-2.5 text-[9px] font-bold uppercase tracking-wider text-slate-500 whitespace-nowrap ${c.cls ?? "text-left"} ${c.key ? "cursor-pointer hover:text-slate-300 select-none" : ""}`}
                    >
                      <span className="inline-flex items-center gap-1">
                        {c.label}
                        {c.key && <SortIcon col={c.key} />}
                      </span>
                    </th>
                  ))}
                  <th className="w-6" />
                </tr>
              </thead>
              <tbody>
                {trades.map((t) => {
                  const isWin = t.net_profit >= 0;
                  const pct   = t.open_price > 0 ? (t.net_profit / t.open_price) * 100 : null;
                  const isExp = expanded === t.id;

                  return (
                    <>
                      <tr
                        key={t.id}
                        onClick={() => setExpanded(isExp ? null : t.id)}
                        className="border-b border-white/5 last:border-0 cursor-pointer hover:bg-white/2 transition-colors"
                      >
                        <td className="px-3 py-2.5 text-slate-500 whitespace-nowrap">{fmtDt(t.open_time)}</td>
                        <td className="px-3 py-2.5 text-slate-500 whitespace-nowrap">{fmtDt(t.close_time)}</td>
                        <td className="px-3 py-2.5 font-bold text-white">{t.ticker}</td>
                        <td className="px-3 py-2.5">
                          <span className={`font-bold text-[10px] ${t.side === "BUY" ? "text-emerald-400" : "text-red-400"}`}>
                            {t.side === "BUY" ? "COMPRA" : "VENTA"}
                          </span>
                        </td>
                        <td className="px-3 py-2.5 text-right text-slate-300 tabular-nums">{t.volume.toFixed(2)}</td>
                        <td className="px-3 py-2.5 text-right text-slate-400 tabular-nums font-mono text-[11px]">{fmtPrice(t.open_price)}</td>
                        <td className="px-3 py-2.5 text-right text-slate-400 tabular-nums font-mono text-[11px]">{fmtPrice(t.close_price)}</td>
                        <td className="px-3 py-2.5 text-right text-slate-600 tabular-nums font-mono text-[11px]">{t.sl != null ? fmtPrice(t.sl) : "—"}</td>
                        <td className="px-3 py-2.5 text-right text-slate-600 tabular-nums font-mono text-[11px]">{t.tp != null ? fmtPrice(t.tp) : "—"}</td>
                        <td className={`px-3 py-2.5 text-right font-bold tabular-nums ${isWin ? "text-emerald-400" : "text-red-400"}`}>
                          {isWin ? "+" : ""}{currency} {Math.abs(t.net_profit).toFixed(2)}
                        </td>
                        <td className={`px-3 py-2.5 text-right text-[10px] tabular-nums ${isWin ? "text-emerald-500/70" : "text-red-500/70"}`}>
                          {pct !== null ? `${pct >= 0 ? "+" : ""}${pct.toFixed(2)}%` : "—"}
                        </td>
                        <td className="px-3 py-2.5">
                          <ChevronRight size={12} className={`text-slate-600 transition-transform ${isExp ? "rotate-90" : ""}`} />
                        </td>
                      </tr>

                      {isExp && (
                        <tr key={`${t.id}-detail`} className="border-b border-white/5 bg-slate-950/40">
                          <td colSpan={12} className="px-5 py-3">
                            <div className="grid grid-cols-2 md:grid-cols-4 gap-x-6 gap-y-1.5 text-[11px]">
                              <div><span className="text-slate-500">Ticket:</span> <span className="text-slate-300 font-mono">{t.ticket || "—"}</span></div>
                              <div><span className="text-slate-500">Duración:</span> <span className="text-slate-300">{fmtDuration(t.duration_seconds)}</span></div>
                              <div><span className="text-slate-500">Comisión:</span> <span className="text-slate-300">{currency} {t.commission.toFixed(2)}</span></div>
                              <div><span className="text-slate-500">Swap:</span> <span className="text-slate-300">{currency} {t.swap.toFixed(2)}</span></div>
                              <div><span className="text-slate-500">Cierre:</span> <span className="text-slate-300">{t.close_reason || "—"}</span></div>
                              {t.comment && <div className="col-span-3"><span className="text-slate-500">Comentario:</span> <span className="text-slate-300">{t.comment}</span></div>}
                            </div>
                          </td>
                        </tr>
                      )}
                    </>
                  );
                })}
              </tbody>

              {/* Totals footer */}
              {trades.length > 0 && (
                <tfoot>
                  <tr className="border-t border-white/8 bg-slate-950/40">
                    <td colSpan={9} className="px-3 py-2.5 text-[9px] font-bold uppercase tracking-widest text-slate-500">
                      Totales ({trades.length} mostrados)
                    </td>
                    <td className={`px-3 py-2.5 text-right font-bold tabular-nums text-xs ${totalPnl >= 0 ? "text-emerald-400" : "text-red-400"}`}>
                      {totalPnl >= 0 ? "+" : ""}{currency} {Math.abs(totalPnl).toFixed(2)}
                    </td>
                    <td className={`px-3 py-2.5 text-right text-[10px] tabular-nums ${avgPct >= 0 ? "text-emerald-500/70" : "text-red-500/70"}`}>
                      {avgPct >= 0 ? "+" : ""}{avgPct.toFixed(2)}%
                    </td>
                    <td />
                  </tr>
                </tfoot>
              )}
            </table>
          </div>
        )}
      </div>

      {/* Pagination */}
      {pages > 1 && (
        <div className="flex items-center justify-center gap-2">
          <button onClick={() => setPage(1)} disabled={page === 1} className="p-1.5 rounded-lg hover:bg-white/5 text-slate-500 disabled:opacity-30">
            <ChevronsLeft size={14} />
          </button>
          {Array.from({ length: Math.min(pages, 7) }, (_, i) => {
            const p = pages <= 7 ? i + 1 : page <= 4 ? i + 1 : page >= pages - 3 ? pages - 6 + i : page - 3 + i;
            return (
              <button
                key={p}
                onClick={() => setPage(p)}
                className={`w-7 h-7 rounded-lg text-[11px] font-bold transition-all ${
                  page === p ? "bg-amber-500/15 text-amber-400 border border-amber-500/30" : "text-slate-500 hover:text-white hover:bg-white/5"
                }`}
              >
                {p}
              </button>
            );
          })}
          <button onClick={() => setPage(pages)} disabled={page === pages} className="p-1.5 rounded-lg hover:bg-white/5 text-slate-500 disabled:opacity-30">
            <ChevronsRight size={14} />
          </button>
        </div>
      )}
    </div>
  );
}
