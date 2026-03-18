"use client";

import { useState, useEffect } from "react";
import { Sparkles, Brain, TrendingUp, TrendingDown, AlertTriangle, Target, Clock, Zap, Sun, Moon, BarChart2 } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { API_BASE } from "../../config";

type AnalysisType = "symbols" | "sessions" | "heatmap";

// ── Response shapes ────────────────────────────────────────────────────────
interface SymbolsResult {
  summary: string;
  trade_failures: string;
  macro_impact: string;
  entry_improvements: string;
  pairs_to_favor: string[];
  pairs_to_avoid: string[];
  suggestions: string[];
}

interface SessionsResult {
  summary: string;
  best_sessions: string;
  worst_sessions: string;
  historical_comparison: string;
  recommendation: string;
}

interface HeatmapResult {
  summary: string;
  golden_hours: string;
  avoid_hours: string;
  weekly_pattern: string;
  schedule_recommendation: string;
}

// ── Per-type card renderers ────────────────────────────────────────────────
function SymbolsReport({ data }: { data: SymbolsResult }) {
  return (
    <div className="space-y-4">
      <SummaryCard text={data.summary} />
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <InfoCard icon={<AlertTriangle className="w-4 h-4 text-red-400" />} label="Fallos en Entradas" color="red" text={data.trade_failures} />
        <InfoCard icon={<Zap className="w-4 h-4 text-amber-400" />} label="Impacto Macro / Noticias" color="amber" text={data.macro_impact} />
        <InfoCard icon={<Target className="w-4 h-4 text-blue-400" />} label="Mejora de Entradas" color="blue" text={data.entry_improvements} />
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <TagList icon={<TrendingUp className="w-4 h-4 text-emerald-400" />} label="Pares a Favorecer" color="emerald" items={data.pairs_to_favor} />
        <TagList icon={<TrendingDown className="w-4 h-4 text-red-400" />} label="Pares a Evitar" color="red" items={data.pairs_to_avoid} />
      </div>
      <SuggestionsList items={data.suggestions} />
    </div>
  );
}

function SessionsReport({ data }: { data: SessionsResult }) {
  return (
    <div className="space-y-4">
      <SummaryCard text={data.summary} />
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <InfoCard icon={<TrendingUp className="w-4 h-4 text-emerald-400" />} label="Mejores Sesiones" color="emerald" text={data.best_sessions} />
        <InfoCard icon={<TrendingDown className="w-4 h-4 text-red-400" />} label="Sesiones a Evitar" color="red" text={data.worst_sessions} />
      </div>
      <InfoCard icon={<BarChart2 className="w-4 h-4 text-blue-400" />} label="Período vs Histórico" color="blue" text={data.historical_comparison} />
      <InfoCard icon={<Target className="w-4 h-4 text-amber-400" />} label="Recomendación" color="amber" text={data.recommendation} />
    </div>
  );
}

function HeatmapReport({ data }: { data: HeatmapResult }) {
  return (
    <div className="space-y-4">
      <SummaryCard text={data.summary} />
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <InfoCard icon={<Sun className="w-4 h-4 text-amber-400" />} label="Horas Doradas" color="amber" text={data.golden_hours} />
        <InfoCard icon={<Moon className="w-4 h-4 text-red-400" />} label="Horas a Evitar" color="red" text={data.avoid_hours} />
      </div>
      <InfoCard icon={<BarChart2 className="w-4 h-4 text-blue-400" />} label="Patrón Semanal" color="blue" text={data.weekly_pattern} />
      <InfoCard icon={<Clock className="w-4 h-4 text-emerald-400" />} label="Horario Recomendado para el Bot" color="emerald" text={data.schedule_recommendation} />
    </div>
  );
}

// ── Shared sub-components ──────────────────────────────────────────────────
function SummaryCard({ text }: { text: string }) {
  return (
    <div className="p-5 bg-gradient-to-br from-slate-900 to-slate-950 border border-amber-500/20 rounded-xl">
      <div className="flex items-center gap-2 mb-3">
        <Brain className="w-4 h-4 text-amber-500" />
        <span className="text-[10px] uppercase tracking-widest text-amber-400 font-bold">Resumen IA</span>
      </div>
      <p className="text-sm text-slate-300 leading-relaxed italic border-l-2 border-amber-500/40 pl-3">
        "{text}"
      </p>
    </div>
  );
}

const colorMap = {
  red:     { border: "border-red-500/20",     text: "text-red-400"     },
  emerald: { border: "border-emerald-500/20", text: "text-emerald-400" },
  amber:   { border: "border-amber-500/20",   text: "text-amber-400"   },
  blue:    { border: "border-blue-500/20",    text: "text-blue-400"    },
};

function InfoCard({ icon, label, color, text }: { icon: React.ReactNode; label: string; color: keyof typeof colorMap; text: string }) {
  const c = colorMap[color];
  return (
    <div className={`p-5 bg-slate-900/60 border ${c.border} rounded-xl`}>
      <div className="flex items-center gap-2 mb-2">
        {icon}
        <span className={`text-[10px] uppercase tracking-widest font-bold ${c.text}`}>{label}</span>
      </div>
      <p className="text-xs text-slate-400 leading-relaxed">{text}</p>
    </div>
  );
}

function TagList({ icon, label, color, items }: { icon: React.ReactNode; label: string; color: keyof typeof colorMap; items: string[] }) {
  const c = colorMap[color];
  return (
    <div className={`p-5 bg-slate-900/60 border ${c.border} rounded-xl`}>
      <div className="flex items-center gap-2 mb-3">
        {icon}
        <span className={`text-[10px] uppercase tracking-widest font-bold ${c.text}`}>{label}</span>
      </div>
      <div className="flex flex-col gap-1.5">
        {items.map((item, i) => (
          <div key={i} className={`text-[11px] px-2 py-1 rounded bg-white/5 border border-white/5 text-slate-300`}>
            {item}
          </div>
        ))}
      </div>
    </div>
  );
}

function SuggestionsList({ items }: { items: string[] }) {
  return (
    <div className="p-5 bg-slate-900/60 border border-white/5 rounded-xl">
      <div className="flex items-center gap-2 mb-3">
        <Target className="w-4 h-4 text-amber-500" />
        <span className="text-[10px] uppercase tracking-[0.2em] text-slate-300 font-bold">Plan de Acción</span>
      </div>
      <div className="space-y-2">
        {items.map((s, i) => (
          <div key={i} className="flex items-start gap-3 p-3 bg-white/5 rounded-lg border border-white/5">
            <div className="w-5 h-5 rounded-full bg-amber-500/20 flex items-center justify-center flex-shrink-0 mt-0.5">
              <span className="text-[10px] font-bold text-amber-500">{i + 1}</span>
            </div>
            <p className="text-xs text-slate-300 leading-snug">{s}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Main component ─────────────────────────────────────────────────────────
export default function AIAnalysisAudit({
  accountId,
  dateFrom,
  dateTo,
  analysisType,
  label = "Análisis IA",
}: {
  accountId: string;
  dateFrom: string | null;
  dateTo: string | null;
  analysisType: AnalysisType;
  label?: string;
}) {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<any | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Reset analysis when period or account changes
  useEffect(() => {
    setResult(null);
    setError(null);
  }, [accountId, dateFrom, dateTo]);

  if (!accountId) return null;

  const run = async () => {
    setLoading(true);
    setError(null);
    setResult(null);
    const token = localStorage.getItem("analytica_token");
    const qs = new URLSearchParams({ analysis_type: analysisType });
    if (dateFrom) qs.append("date_from", dateFrom);
    if (dateTo)   qs.append("date_to", dateTo);

    try {
      const res = await fetch(
        `${API_BASE}/api/v1/trading/analyze-performance/${accountId}?${qs}`,
        { method: "POST", headers: { Authorization: `Bearer ${token}` } }
      );
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.detail || "No se pudo generar el análisis.");
      }
      setResult(await res.json());
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="pt-4 mt-4 border-t border-white/5">
      {!loading && (
        <button
          onClick={run}
          className="group relative flex items-center justify-center gap-3 w-full py-3 rounded-lg bg-amber-500/5 border border-amber-500/10 hover:border-amber-500/30 hover:bg-amber-500/10 transition-all overflow-hidden"
        >
          <div className="absolute inset-0 bg-gradient-to-r from-amber-500/0 via-amber-500/5 to-amber-500/0 opacity-0 group-hover:opacity-100 transition-opacity" />
          <Sparkles className="w-3.5 h-3.5 text-amber-500/80 group-hover:text-amber-500 transition-all duration-300" />
          <span className="text-[9px] uppercase tracking-[0.25em] text-slate-400 font-bold group-hover:text-amber-400 transition-colors">
            {result ? `↺ Re-analizar — ${label}` : label}
          </span>
        </button>
      )}

      {loading && (
        <div className="flex flex-col items-center justify-center p-12 bg-slate-900/40 border border-white/5 rounded-xl gap-4">
          <div className="relative">
            <Brain className="w-10 h-10 text-amber-500/20 animate-pulse" />
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="w-12 h-12 border-2 border-t-amber-500 border-amber-500/10 rounded-full animate-spin" />
            </div>
          </div>
          <p className="text-[10px] uppercase tracking-[0.2em] text-amber-500/60 font-medium animate-pulse">
            Gemini analizando datos...
          </p>
        </div>
      )}

      {error && !loading && (
        <div className="p-4 bg-red-500/10 border border-red-500/20 rounded-xl text-center">
          <p className="text-xs text-red-400 font-medium">{error}</p>
          <button onClick={run} className="text-[10px] uppercase tracking-wider text-red-500 font-bold mt-2 hover:underline">
            Reintentar
          </button>
        </div>
      )}

      <AnimatePresence>
        {result && (
          <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} className="space-y-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-[9px] uppercase tracking-[0.2em] text-amber-500/60 font-bold">
                Reporte IA — {analysisType === "symbols" ? "Símbolos" : analysisType === "sessions" ? "Sesiones" : "Horarios"}
              </span>
            </div>

            {analysisType === "symbols"  && <SymbolsReport  data={result as SymbolsResult}  />}
            {analysisType === "sessions" && <SessionsReport data={result as SessionsResult} />}
            {analysisType === "heatmap"  && <HeatmapReport  data={result as HeatmapResult}  />}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
