"use client";

import { useState } from "react";
import { CalendarRange, ChevronDown, X } from "lucide-react";
import { useDateFilter, Period, AssetClass } from "../../contexts/DateFilterContext";

interface SymbolOption {
  ticker: string;
  asset_class: string;
  trades: number;
}

interface Props {
  availableSymbols?: SymbolOption[];
}

const DATE_CHIPS: { label: string; value: Period }[] = [
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

const ASSET_CHIPS: { label: string; value: AssetClass; emoji: string }[] = [
  { label: "Todos",    value: null,          emoji: "🔘" },
  { label: "Forex",    value: "FOREX",       emoji: "💱" },
  { label: "Metales",  value: "METALS",      emoji: "🥇" },
  { label: "Índices",  value: "INDICES",     emoji: "📊" },
  { label: "Cripto",   value: "CRYPTO",      emoji: "₿"  },
  { label: "Materias", value: "COMMODITIES", emoji: "🛢️" },
];

export default function DateFilterBar({ availableSymbols = [] }: Props) {
  const { period, assetClass, symbol, setPeriod, setAssetClass, setSymbol } = useDateFilter();
  const [customFrom, setCustomFrom] = useState("");
  const [customTo,   setCustomTo]   = useState("");

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

  const handleAssetClass = (ac: AssetClass) => {
    setAssetClass(ac);
    setSymbol(null);
  };

  // Symbols filtered by selected asset class
  const symbolsForDropdown = assetClass
    ? availableSymbols.filter(s => s.asset_class === assetClass)
    : availableSymbols;

  const hasActiveAssetFilter = assetClass !== null || symbol !== null;

  return (
    <div className="sticky top-0 z-20 -mx-4 md:-mx-8 lg:-mx-10 bg-slate-950/90 backdrop-blur-md border-b border-white/5">

      {/* Row 1 — Date period chips */}
      <div className="flex items-center gap-1 px-4 md:px-8 lg:px-10 pt-2 pb-1 flex-wrap">
        <CalendarRange size={11} className="text-slate-600 mr-1 shrink-0" />

        {DATE_CHIPS.map((chip) => {
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
                <ChevronDown size={9} className={active ? "text-amber-400" : "text-slate-600"} />
              )}
            </button>
          );
        })}

        {/* Custom date inputs */}
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

      {/* Row 2 — Asset class chips + Symbol dropdown */}
      <div className="flex items-center gap-1.5 px-4 md:px-8 lg:px-10 pb-2 flex-wrap">
        <span className="text-[9px] font-bold uppercase tracking-widest text-slate-600 mr-1 shrink-0">Activo:</span>

        {ASSET_CHIPS.map((chip) => {
          const active = assetClass === chip.value;
          return (
            <button
              key={String(chip.value)}
              onClick={() => handleAssetClass(chip.value)}
              className={`
                flex items-center gap-1 px-2.5 py-1 rounded-lg text-[9px] font-bold uppercase tracking-wider
                transition-all duration-150 shrink-0
                ${active
                  ? "bg-sky-500/15 text-sky-400 border border-sky-500/30"
                  : "text-slate-500 hover:text-slate-300 border border-transparent hover:border-white/8 hover:bg-white/5"
                }
              `}
            >
              <span className="text-[10px]">{chip.emoji}</span>
              {chip.label}
            </button>
          );
        })}

        {/* Symbol dropdown — only show when symbols are available */}
        {availableSymbols.length > 0 && (
          <div className="flex items-center gap-1.5 ml-2">
            <span className="text-[9px] font-bold uppercase tracking-widest text-slate-600 shrink-0">Par:</span>
            <div className="relative">
              <select
                value={symbol ?? ""}
                onChange={(e) => setSymbol(e.target.value || null)}
                className="appearance-none bg-slate-900 border border-white/10 rounded-lg pl-2.5 pr-6 py-1 text-[10px] text-slate-300 focus:outline-none focus:border-sky-500/50 transition-all cursor-pointer"
              >
                <option value="">Todos</option>
                {symbolsForDropdown.map((s) => (
                  <option key={s.ticker} value={s.ticker}>
                    {s.ticker} ({s.trades})
                  </option>
                ))}
              </select>
              <ChevronDown size={9} className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-500 pointer-events-none" />
            </div>
          </div>
        )}

        {/* Clear active asset/symbol filter */}
        {hasActiveAssetFilter && (
          <button
            onClick={() => { setAssetClass(null); setSymbol(null); }}
            className="flex items-center gap-1 ml-1 px-2 py-1 rounded-lg text-[9px] text-slate-500 hover:text-red-400 border border-transparent hover:border-red-500/20 hover:bg-red-500/5 transition-all"
          >
            <X size={9} />
            Limpiar
          </button>
        )}
      </div>
    </div>
  );
}
