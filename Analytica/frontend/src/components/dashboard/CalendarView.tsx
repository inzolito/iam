"use client";

import { useState, useEffect, useCallback } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";

interface CalendarDay {
  date: string;
  daily_pl: number;
  trades_count: number;
  balance_end: number;
}

const MONTHS = [
  "Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio",
  "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre",
];
const DOW = ["Lun", "Mar", "Mié", "Jue", "Vie", "Sáb", "Dom"];

export default function CalendarView({
  accountId,
  apiBase,
  currency = "USD",
}: {
  accountId: string;
  apiBase: string;
  currency?: string;
}) {
  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth() + 1); // 1-based
  const [data, setData] = useState<CalendarDay[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetch_ = useCallback(async () => {
    if (!accountId) return;
    setLoading(true);
    setError(null);
    try {
      const token = localStorage.getItem("analytica_token");
      const res = await fetch(
        `${apiBase}/api/v1/trading/calendar/${accountId}?year=${year}&month=${month}`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      if (res.ok) {
        setData(await res.json());
      } else {
        const detail = await res.json().catch(() => null);
        setError(detail?.detail ?? `Error ${res.status}`);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error de red");
    } finally {
      setLoading(false);
    }
  }, [accountId, apiBase, year, month]);

  useEffect(() => { fetch_(); }, [fetch_]);

  const prev = () => {
    if (month === 1) { setYear(y => y - 1); setMonth(12); }
    else setMonth(m => m - 1);
  };
  const next = () => {
    if (month === 12) { setYear(y => y + 1); setMonth(1); }
    else setMonth(m => m + 1);
  };

  // Build calendar grid
  const firstDay = new Date(year, month - 1, 1);
  const daysInMonth = new Date(year, month, 0).getDate();
  // ISO: Monday=1 … Sunday=7; JS: Sunday=0 so remap
  let startDow = firstDay.getDay(); // 0=Sun
  startDow = startDow === 0 ? 6 : startDow - 1; // convert to Mon=0

  const dayMap: Record<string, CalendarDay> = {};
  for (const d of data) dayMap[d.date] = d;

  const cells: (null | CalendarDay | "empty")[] = [
    ...Array(startDow).fill(null),
    ...Array.from({ length: daysInMonth }, (_, i) => {
      const dateStr = `${year}-${String(month).padStart(2, "0")}-${String(i + 1).padStart(2, "0")}`;
      return dayMap[dateStr] ?? dateStr;
    }),
  ];

  const maxAbs = Math.max(...data.map((d) => Math.abs(d.daily_pl)), 0.01);

  return (
    <div className="w-full">
      <div className="flex items-center justify-between mb-4">
        <p className="text-[10px] uppercase tracking-[0.2em] text-slate-500 font-bold">
          Calendario de Resultados
        </p>
        <div className="flex items-center gap-2">
          <button onClick={prev} className="p-1 rounded-lg hover:bg-white/5 text-slate-400 hover:text-white transition-colors">
            <ChevronLeft size={14} />
          </button>
          <span className="text-xs font-bold text-white min-w-[120px] text-center">
            {MONTHS[month - 1]} {year}
          </span>
          <button onClick={next} className="p-1 rounded-lg hover:bg-white/5 text-slate-400 hover:text-white transition-colors">
            <ChevronRight size={14} />
          </button>
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-12">
          <div className="w-4 h-4 border-2 border-t-amber-500 border-amber-500/20 rounded-full animate-spin" />
        </div>
      ) : error ? (
        <div className="py-8 text-center">
          <p className="text-xs text-red-400 bg-red-500/8 border border-red-500/15 rounded-lg px-4 py-3 inline-block">
            Error al cargar el calendario: {error}
          </p>
        </div>
      ) : (
        <>
          {/* DOW headers */}
          <div className="grid grid-cols-7 mb-1">
            {DOW.map((d) => (
              <div key={d} className="text-center text-[9px] text-slate-600 font-bold uppercase py-1">{d}</div>
            ))}
          </div>
          {/* Calendar grid */}
          <div className="grid grid-cols-7 gap-0.5">
            {cells.map((cell, i) => {
              if (cell === null) {
                return <div key={i} className="aspect-square" />;
              }
              if (typeof cell === "string") {
                // Day with no data
                const dayNum = parseInt(cell.split("-")[2]);
                return (
                  <div key={i} className="aspect-square rounded-md bg-slate-950/20 flex flex-col items-center justify-center">
                    <span className="text-[9px] text-slate-700">{dayNum}</span>
                  </div>
                );
              }
              const d = cell as CalendarDay;
              const dayNum = parseInt(d.date.split("-")[2]);
              const isPos = d.daily_pl > 0;
              const intensity = Math.min(Math.abs(d.daily_pl) / maxAbs, 1);
              const bg = d.daily_pl === 0
                ? "rgba(255,255,255,0.03)"
                : isPos
                  ? `rgba(16,185,129,${0.12 + intensity * 0.45})`
                  : `rgba(244,63,94,${0.12 + intensity * 0.45})`;
              return (
                <div
                  key={i}
                  className="aspect-square rounded-md flex flex-col items-center justify-center cursor-default transition-opacity hover:opacity-80 p-0.5"
                  style={{ backgroundColor: bg }}
                  title={`${d.date}\nPnL: ${d.daily_pl >= 0 ? "+" : ""}${currency} ${d.daily_pl.toFixed(2)}\nTrades: ${d.trades_count}`}
                >
                  <span className="text-[8px] text-slate-500">{dayNum}</span>
                  <span className={`text-[8px] font-bold leading-tight ${isPos ? "text-emerald-300" : "text-red-300"}`}>
                    {isPos ? "+" : ""}{d.daily_pl.toFixed(0)}
                  </span>
                </div>
              );
            })}
          </div>
          {/* Summary */}
          {data.length > 0 && (
            <div className="flex items-center gap-4 mt-4 pt-4 border-t border-white/5">
              <div>
                <p className="text-[9px] text-slate-500 uppercase tracking-widest">Días con datos</p>
                <p className="text-sm font-bold text-white">{data.length}</p>
              </div>
              <div>
                <p className="text-[9px] text-slate-500 uppercase tracking-widest">PnL del mes</p>
                <p className={`text-sm font-bold ${data.reduce((a, b) => a + b.daily_pl, 0) >= 0 ? "text-emerald-400" : "text-red-400"}`}>
                  {data.reduce((a, b) => a + b.daily_pl, 0) >= 0 ? "+" : ""}
                  {currency} {Math.abs(data.reduce((a, b) => a + b.daily_pl, 0)).toFixed(2)}
                </p>
              </div>
              <div>
                <p className="text-[9px] text-slate-500 uppercase tracking-widest">Días ganadores</p>
                <p className="text-sm font-bold text-emerald-400">{data.filter((d) => d.daily_pl > 0).length}</p>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
