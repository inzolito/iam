"use client";

import { useState } from "react";
import { CalendarRange, ChevronDown } from "lucide-react";
import { useDateFilter, Period } from "../../contexts/DateFilterContext";

const CHIPS: { label: string; value: Period }[] = [
  { label: "Hoy",           value: "today"     },
  { label: "Ayer",          value: "yesterday" },
  { label: "Esta Semana",   value: "week"      },
  { label: "Sem. Pasada",   value: "lastweek"  },
  { label: "Este Mes",      value: "month"     },
  { label: "Mes Pasado",    value: "lastmonth" },
  { label: "3 Meses",       value: "3m"        },
  { label: "6 Meses",       value: "6m"        },
  { label: "Año",           value: "year"      },
  { label: "Todo",          value: "all"       },
  { label: "Personalizado", value: "custom"    },
];

export default function DateFilterBar() {
  const { period, dateFrom, dateTo, setPeriod } = useDateFilter();
  const [customFrom, setCustomFrom] = useState(dateFrom ?? "");
  const [customTo,   setCustomTo]   = useState(dateTo   ?? "");

  const handleChip = (p: Period) => {
    if (p === "custom") {
      setPeriod("custom", customFrom || undefined, customTo || undefined);
    } else {
      setPeriod(p);
    }
  };

  const handleApply = () => {
    if (customFrom) setPeriod("custom", customFrom, customTo || undefined);
  };

  return (
    <div className="sticky top-0 z-20 -mx-4 md:-mx-8 lg:-mx-10 bg-slate-950/90 backdrop-blur-md border-b border-white/5">
      <div className="flex items-center gap-1 px-4 md:px-8 lg:px-10 py-2 flex-wrap">
        <CalendarRange size={11} className="text-slate-600 mr-1 shrink-0" />

        {CHIPS.map((chip) => {
          const active = period === chip.value;
          return (
            <button
              key={chip.value}
              onClick={() => handleChip(chip.value)}
              className={`
                flex items-center gap-1 px-3 py-1.5 rounded-lg text-[10px] font-bold uppercase tracking-wider
                transition-all duration-150 shrink-0
                ${active
                  ? "bg-amber-500/15 text-amber-400 border border-amber-500/30"
                  : "text-slate-500 hover:text-slate-300 border border-transparent hover:border-white/8 hover:bg-white/5"
                }
              `}
            >
              {chip.label}
              {chip.value === "custom" && (
                <ChevronDown
                  size={9}
                  className={active ? "text-amber-400" : "text-slate-600"}
                />
              )}
            </button>
          );
        })}

        {/* Custom range inputs — shown only when custom chip is active */}
        {period === "custom" && (
          <div className="flex items-center gap-2 ml-1 flex-wrap">
            <input
              type="date"
              value={customFrom}
              onChange={(e) => setCustomFrom(e.target.value)}
              className="[color-scheme:dark] bg-slate-900 border border-white/10 rounded-lg px-3 py-1.5 text-[11px] text-white focus:outline-none focus:border-amber-500/50 focus:ring-1 focus:ring-amber-500/20 transition-all"
            />
            <span className="text-slate-600 text-[10px]">→</span>
            <input
              type="date"
              value={customTo}
              min={customFrom || undefined}
              onChange={(e) => setCustomTo(e.target.value)}
              className="[color-scheme:dark] bg-slate-900 border border-white/10 rounded-lg px-3 py-1.5 text-[11px] text-white focus:outline-none focus:border-amber-500/50 focus:ring-1 focus:ring-amber-500/20 transition-all"
            />
            <button
              onClick={handleApply}
              disabled={!customFrom}
              className="px-3 py-1.5 rounded-lg bg-amber-500/15 text-amber-400 border border-amber-500/30 text-[10px] font-bold uppercase tracking-wider hover:bg-amber-500/25 transition-all disabled:opacity-40 disabled:cursor-not-allowed"
            >
              Aplicar
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
