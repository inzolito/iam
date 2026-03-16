"use client";

import { useState } from "react";
import { Sparkles, Brain, TrendingUp, AlertTriangle, Target, Clock, Zap, Download } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { API_BASE } from "../../config";

interface AIAnalysis {
  summary: string;
  negative_trades_root_cause: string;
  positive_trades_success_factors: string;
  suggestions: string[];
  session_comparison: { insight: string; recommendation: string };
  heatmap_insights: { best_hours: string; worst_hours: string };
}

export default function AIAnalysisAudit({ accountId, dateFrom, dateTo, label = "Generar Auditoría IA Fundamental" }: { accountId: string; dateFrom: string | null; dateTo: string | null; label?: string }) {
  const [loading, setLoading] = useState(false);
  const [analysis, setAnalysis] = useState<AIAnalysis | null>(null);
  const [error, setError] = useState<string | null>(null);

  if (!accountId) return null;

  const performAudit = async () => {
    setLoading(true);
    setError(null);
    setAnalysis(null);
    const token = localStorage.getItem("analytica_token");
    
    const qs = new URLSearchParams();
    if (dateFrom) qs.append("date_from", dateFrom);
    if (dateTo) qs.append("date_to", dateTo);
    qs.append("system_version", "1.0.0");

    try {
      const res = await fetch(`${API_BASE}/api/v1/trading/analyze-performance/${accountId}?${qs.toString()}`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
      });

      if (!res.ok) {
        throw new Error("No se pudo generar el análisis de IA. Inténtalo de nuevo.");
      }

      const data = await res.json();
      setAnalysis(data);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="pt-4 mt-4 border-t border-white/5">
      {!analysis && !loading && (
        <button
          onClick={performAudit}
          className="group relative flex items-center justify-center gap-3 w-full py-3 rounded-lg bg-amber-500/5 border border-amber-500/10 hover:border-amber-500/30 hover:bg-amber-500/10 transition-all overflow-hidden"
        >
          <div className="absolute inset-0 bg-gradient-to-r from-amber-500/0 via-amber-500/5 to-amber-500/0 opacity-0 group-hover:opacity-100 transition-opacity" />
          <Sparkles className="w-3.5 h-3.5 text-amber-500/80 group-hover:text-amber-500 group-hover:scale-110 transition-all duration-300" />
          <span className="text-[9px] uppercase tracking-[0.25em] text-slate-400 font-bold group-hover:text-amber-400 transition-colors">
            {label}
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
            Gemini 2.0 Flash Lite está analizando tus trades y noticias macro...
          </p>
        </div>
      )}

      {error && !loading && (
        <div className="p-4 bg-red-500/10 border border-red-500/20 rounded-xl text-center">
          <p className="text-xs text-red-400 font-medium">{error}</p>
          <button onClick={performAudit} className="text-[10px] uppercase tracking-wider text-red-500 font-bold mt-2 hover:underline">
            Reintentar
          </button>
        </div>
      )}

      <AnimatePresence>
        {analysis && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="space-y-4"
          >
            {/* Summary Card */}
            <div className="p-6 bg-gradient-to-br from-slate-900 to-slate-950 border border-amber-500/20 rounded-xl shadow-2xl">
              <div className="flex items-center gap-3 mb-4">
                <div className="p-2 rounded-lg bg-amber-500/10 border border-amber-500/20">
                  <Brain className="w-5 h-5 text-amber-500" />
                </div>
                <h3 className="text-sm font-bold text-white uppercase tracking-wider">Reporte de Auditoría IA</h3>
              </div>
              <p className="text-sm text-slate-300 leading-relaxed italic border-l-2 border-amber-500/40 pl-4 py-1">
                "{analysis.summary}"
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Root Cause Card */}
              <div className="p-5 bg-slate-900/60 border border-red-500/20 rounded-xl">
                <div className="flex items-center gap-2 mb-3">
                  <AlertTriangle className="w-4 h-4 text-red-400" />
                  <span className="text-[10px] uppercase tracking-widest text-red-400 font-bold">Anatomía de Pérdidas</span>
                </div>
                <p className="text-xs text-slate-400 leading-relaxed">
                  {analysis.negative_trades_root_cause}
                </p>
              </div>

              {/* Success Factors Card */}
              <div className="p-5 bg-slate-900/60 border border-emerald-500/20 rounded-xl">
                <div className="flex items-center gap-2 mb-3">
                  <TrendingUp className="w-4 h-4 text-emerald-400" />
                  <span className="text-[10px] uppercase tracking-widest text-emerald-400 font-bold">Factores de Éxito</span>
                </div>
                <p className="text-xs text-slate-400 leading-relaxed">
                  {analysis.positive_trades_success_factors}
                </p>
              </div>

              {/* Session Insights */}
              <div className="p-5 bg-slate-900/60 border border-blue-500/20 rounded-xl">
                <div className="flex items-center gap-2 mb-3">
                  <Clock className="w-4 h-4 text-blue-400" />
                  <span className="text-[10px] uppercase tracking-widest text-blue-400 font-bold">Dinámica de Sesiones</span>
                </div>
                <div className="space-y-2">
                  <p className="text-xs text-slate-300 font-medium">Insight: <span className="text-slate-400 font-normal">{analysis.session_comparison.insight}</span></p>
                  <p className="text-xs text-slate-300 font-medium">Acción: <span className="text-slate-400 font-normal">{analysis.session_comparison.recommendation}</span></p>
                </div>
              </div>

              {/* Heatmap Insights */}
              <div className="p-5 bg-slate-900/60 border border-amber-500/20 rounded-xl">
                <div className="flex items-center gap-2 mb-3">
                  <Zap className="w-4 h-4 text-amber-400" />
                  <span className="text-[10px] uppercase tracking-widest text-amber-400 font-bold">Optimización Horaria</span>
                </div>
                <div className="space-y-2">
                  <p className="text-xs text-emerald-400 font-medium">Horas de Oro: <span className="text-slate-400 font-normal">{analysis.heatmap_insights.best_hours}</span></p>
                  <p className="text-xs text-red-400 font-medium">Zona Prohibida: <span className="text-slate-400 font-normal">{analysis.heatmap_insights.worst_hours}</span></p>
                </div>
              </div>
            </div>

            {/* Suggestions Checklist */}
            <div className="p-6 bg-slate-900/60 border border-white/5 rounded-xl">
              <div className="flex items-center gap-2 mb-4">
                <Target className="w-4 h-4 text-amber-500" />
                <span className="text-[10px] uppercase tracking-[0.2em] text-slate-300 font-bold">Plan de Acción (Daily 10% Yield Goal)</span>
              </div>
              <div className="grid grid-cols-1 gap-3">
                {analysis.suggestions.map((s, i) => (
                  <div key={i} className="flex items-start gap-4 p-3 bg-white/5 rounded-lg border border-white/5">
                    <div className="w-5 h-5 rounded-full bg-amber-500/20 flex items-center justify-center flex-shrink-0 mt-0.5">
                      <span className="text-[10px] font-bold text-amber-500">{i + 1}</span>
                    </div>
                    <p className="text-xs text-slate-300 leading-snug">{s}</p>
                  </div>
                ))}
              </div>
            </div>
            
            <button
              onClick={() => setAnalysis(null)}
              className="text-[10px] uppercase tracking-widest text-slate-500 hover:text-white transition-colors block mx-auto py-2"
            >
              Cerrar Informe
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
