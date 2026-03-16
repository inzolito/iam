"use client";

interface HeatmapCell {
  day: number;
  hour: number;
  avg_pnl: number;
  count: number;
}

// PostgreSQL DOW: 0=Sun, 1=Mon … 6=Sat → remap to Mon-Sun
const DAY_LABELS = ["Dom", "Lun", "Mar", "Mié", "Jue", "Vie", "Sáb"];
const HOUR_LABELS = Array.from({ length: 24 }, (_, i) => `${i}:00`);

function cellColor(pnl: number, max: number): string {
  if (pnl === 0) return "rgba(255,255,255,0.03)";
  const intensity = Math.min(Math.abs(pnl) / max, 1);
  if (pnl > 0) return `rgba(16,185,129,${0.15 + intensity * 0.65})`;
  return `rgba(244,63,94,${0.15 + intensity * 0.65})`;
}

export default function HeatmapChart({ data }: { data: HeatmapCell[] }) {
  if (!data.length) return null;

  const grid: Record<string, HeatmapCell> = {};
  for (const cell of data) {
    grid[`${cell.day}-${cell.hour}`] = cell;
  }

  const maxAbs = Math.max(...data.map((c) => Math.abs(c.avg_pnl)), 0.01);

  return (
    <div className="overflow-x-auto pb-4">
      <div className="min-w-[640px] bg-slate-900/40 rounded-xl border border-white/5 p-5">
        <p className="text-[10px] uppercase tracking-[0.2em] text-slate-500 font-bold mb-6">
          Distribución de PnL por Horario
        </p>

        {/* Hour header */}
        <div className="flex mb-1">
          <div className="w-10 shrink-0" />
          {HOUR_LABELS.filter((_, i) => i % 2 === 0).map((h) => (
            <div key={h} className="flex-1 text-center text-[8px] text-slate-600">
              {h}
            </div>
          ))}
        </div>
        
        {/* Rows: days */}
        {DAY_LABELS.map((day, dayIdx) => (
          <div key={day} className="flex items-center mb-0.5">
            <div className="w-10 text-[9px] text-slate-500 shrink-0 font-bold">{day}</div>
            {Array.from({ length: 24 }, (_, hour) => {
              const cell = grid[`${dayIdx}-${hour}`];
              const pnl = cell?.avg_pnl ?? 0;
              return (
                <div
                  key={hour}
                  className="flex-1 rounded-sm cursor-default transition-opacity hover:opacity-80"
                  style={{ height: 18, backgroundColor: cellColor(pnl, maxAbs), minWidth: 11 }}
                  title={cell ? `${day} ${hour}:00 — Prom: ${pnl.toFixed(2)} (${cell.count} trades)` : `${day} ${hour}:00 — Sin datos`}
                />
              );
            })}
          </div>
        ))}

        {/* Legend */}
        <div className="flex items-center gap-2 mt-4">
          <div className="h-2 w-20 rounded-full" style={{ background: "linear-gradient(to right, rgba(244,63,94,0.8), rgba(255,255,255,0.03), rgba(16,185,129,0.8))" }} />
          <span className="text-[9px] text-slate-600 uppercase tracking-widest font-medium">Pérdida → Neutro → Ganancia</span>
        </div>
      </div>
    </div>
  );
}
