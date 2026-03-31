"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import {
  Lock,
  Eye,
  EyeOff,
  ShieldCheck,
  ArrowRight,
} from "lucide-react";
import CloseReasonChart from "../../components/dashboard/CloseReasonChart";
import EquityCurve from "../../components/dashboard/EquityCurve";
import SymbolTable from "../../components/dashboard/SymbolTable";
import Phase2Metrics from "../../components/dashboard/Phase2Metrics";
import AssetRanking from "../../components/dashboard/AssetRanking";
import SessionChart from "../../components/dashboard/SessionChart";
import HoldingTimeScatter from "../../components/dashboard/HoldingTimeScatter";
import HeatmapChart from "../../components/dashboard/HeatmapChart";
import Phase4Metrics from "../../components/dashboard/Phase4Metrics";
import CalendarView from "../../components/dashboard/CalendarView";
import BalanceHero from "../../components/dashboard/BalanceHero";
import CorrelationMatrix from "../../components/dashboard/CorrelationMatrix";
import OpenPositions from "../../components/dashboard/OpenPositions";
import MarketSessions from "../../components/dashboard/MarketSessions";
import TradeHistory from "../../components/dashboard/TradeHistory";
import DateFilterBar from "../../components/dashboard/DateFilterBar";
import CollapsibleSection from "../../components/dashboard/CollapsibleSection";
import AIAnalysisAudit from "../../components/dashboard/AIAnalysisAudit";
import { useDateFilter } from "../../contexts/DateFilterContext";
import { useAccount } from "../../contexts/AccountContext";
import { API_BASE } from "../../config";

interface Account {
  id: string;
  name: string;
  platform: string;
  currency: string;
  connection_type: string;
  broker_server?: string | null;
  mt5_login?: string | null;
  sync_error?: string | null;
}

interface Stats {
  current_balance: number | null;
  total_trades: number;
  net_profit: number;
  win_rate: number | null;
  avg_win: number | null;
  avg_loss: number | null;
  rr_ratio: number | null;
  tp_count: number;
  sl_count: number;
  manual_count: number;
  unknown_count: number;
  tp_rate: number | null;
  total_volume_lots: number | null;
  manual_rate: number | null;
  profit_factor: number | null;
  max_drawdown_pct: number | null;
  max_drawdown_usd: number | null;
  max_win_streak: number;
  max_loss_streak: number;
  current_streak: number;
  current_streak_type: string | null;
  expected_payoff: number | null;
  avg_duration_seconds: number | null;
  avg_duration_human: string | null;
  total_commission: number;
  total_swap: number;
  cost_impact_pct: number | null;
  gross_profit: number;
  gross_loss: number;
  z_score: number | null;
  z_interpretation: string | null;
  sharpe_ratio: number | null;
  sqn: number | null;
  sqn_rating: string | null;
  recovery_factor: number | null;
}

interface EquityPoint {
  date: string;
  balance: number;
  daily_pl: number;
  trades_count: number;
}

interface SymbolRow {
  ticker: string;
  total_trades: number;
  winning_trades: number;
  losing_trades: number;
  total_pnl: number;
  avg_pnl: number | null;
  win_rate: number | null;
}

interface SessionRow {
  session: string;
  total_pnl: number;
  avg_pnl: number;
  win_rate: number;
  trades: number;
}

interface TradeRow {
  id: string;
  ticker: string;
  duration_hours: number;
  net_profit: number;
  close_reason: string | null;
}

interface HeatmapCell {
  day: number;
  hour: number;
  avg_pnl: number;
  count: number;
}

export default function DashboardPage() {
  const router = useRouter();
  const { accounts, selectedAccount, reloadAccounts: ctxReload } = useAccount();
  const [stats, setStats] = useState<Stats | null>(null);
  const [equityCurve, setEquityCurve] = useState<EquityPoint[]>([]);
  const [symbolData, setSymbolData] = useState<SymbolRow[]>([]);
  const [sessionData, setSessionData] = useState<SessionRow[]>([]);
  const [tradesList, setTradesList] = useState<TradeRow[]>([]);
  const [heatmapData, setHeatmapData] = useState<HeatmapCell[]>([]);
  const [correlationData, setCorrelationData] = useState<{symbols: string[]; matrix: {symbol_a:string; symbol_b:string; correlation:number; trades_a:number; trades_b:number}[]}>({symbols:[], matrix:[]});
  const [liveEquity, setLiveEquity] = useState<number | null>(null);
  const [openPositions, setOpenPositions] = useState<any[]>([]);
  const currentFiltersRef = useRef<{ dateFrom: string | null; dateTo: string | null; assetClass: string | null; symbol: string | null }>({ dateFrom: null, dateTo: null, assetClass: null, symbol: null });
  const [isLoading, setIsLoading] = useState(true);
  const [statsLoading, setStatsLoading] = useState(false);
  const [totalTradesEver, setTotalTradesEver] = useState<number | null>(null);
  const [overallBalance, setOverallBalance] = useState<number | null>(null);
  
  const [inlinePassword, setInlinePassword] = useState("");
  const [showInlinePw, setShowInlinePw] = useState(false);
  const [inlineLoading, setInlineLoading] = useState(false);
  const [inlineError, setInlineError] = useState("");
  const [syncLoading, setSyncLoading] = useState(false);
  const [syncError, setSyncError] = useState("");
  const [availableSymbols, setAvailableSymbols] = useState<Array<{ ticker: string; asset_class: string; trades: number }>>([]);

  const { dateFrom, dateTo, assetClass, symbol } = useDateFilter();

  useEffect(() => {
    const token = localStorage.getItem("analytica_token");
    if (!token) { router.replace("/login"); return; }
  }, [router]);

  useEffect(() => {
    if (accounts.length === 0 && !isLoading) router.replace("/connect");
    else if (accounts.length > 0) setIsLoading(false);
  }, [accounts, isLoading, router]);

  const fetchStats = useCallback(async (
    account: Account,
    dFrom: string | null = null,
    dTo: string | null = null,
    acClass: string | null = null,
    sym: string | null = null,
  ) => {
    setStatsLoading(true);
    const token = localStorage.getItem("analytica_token");
    const authHeader = token ? { Authorization: `Bearer ${token}` } : {};
    const qs = new URLSearchParams();
    if (dFrom)   qs.append("date_from",   dFrom);
    if (dTo)     qs.append("date_to",     dTo);
    if (acClass) qs.append("asset_class", acClass);
    if (sym)     qs.append("symbol",      sym);
    const q = qs.toString() ? `?${qs}` : "";
    try {
      const [statsRes, equityRes, symbolRes, sessionRes, tradesRes, heatmapRes, correlRes] = await Promise.all([
        fetch(`${API_BASE}/api/v1/trading/stats/${account.id}${q}`, { headers: authHeader }),
        fetch(`${API_BASE}/api/v1/trading/equity-curve/${account.id}${q}`, { headers: authHeader }),
        fetch(`${API_BASE}/api/v1/trading/by-symbol/${account.id}${q}`, { headers: authHeader }),
        fetch(`${API_BASE}/api/v1/trading/by-session/${account.id}${q}`, { headers: authHeader }),
        fetch(`${API_BASE}/api/v1/trading/trades/${account.id}${q}`, { headers: authHeader }),
        fetch(`${API_BASE}/api/v1/trading/heatmap/${account.id}${q}`, { headers: authHeader }),
        fetch(`${API_BASE}/api/v1/trading/correlation/${account.id}${q}`, { headers: authHeader }),
      ]);

      const s = statsRes.ok ? await statsRes.json() : null;

      if (s) setStats(s);
      if (equityRes.ok) setEquityCurve(await equityRes.json());
      if (symbolRes.ok) setSymbolData(await symbolRes.json());
      if (sessionRes.ok) setSessionData(await sessionRes.json());
      if (tradesRes.ok) setTradesList(await tradesRes.json());
      if (heatmapRes.ok) setHeatmapData(await heatmapRes.json());
      if (correlRes.ok) setCorrelationData(await correlRes.json());
    } catch {
    } finally {
      setStatsLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!selectedAccount) return;
    const timer = setTimeout(() => {
      fetchStats(selectedAccount, dateFrom, dateTo, assetClass, symbol);
    }, 150);
    return () => clearTimeout(timer);
  }, [selectedAccount, fetchStats, dateFrom, dateTo, assetClass, symbol]);

  // Fetch total trades ever (no date filter) to decide whether to show sync screen
  useEffect(() => {
    if (!selectedAccount) return;
    const token = localStorage.getItem("analytica_token");
    setTotalTradesEver(null);
    fetch(`${API_BASE}/api/v1/trading/stats/${selectedAccount.id}`, {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    })
      .then((r) => r.ok ? r.json() : null)
      .then((s) => {
        if (s) {
          setTotalTradesEver(s.total_trades ?? 0);
          setOverallBalance(s.current_balance ?? null);
        }
      })
      .catch(() => {});
  }, [selectedAccount]);

  // Fetch all symbols for the filter dropdown (no date/asset filter — always all-time)
  useEffect(() => {
    if (!selectedAccount) return;
    const token = localStorage.getItem("analytica_token");
    fetch(`${API_BASE}/api/v1/trading/symbols/${selectedAccount.id}`, {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    })
      .then((r) => r.ok ? r.json() : [])
      .then((data) => setAvailableSymbols(Array.isArray(data) ? data : []))
      .catch(() => {});
  }, [selectedAccount]);

  const reloadAccounts = useCallback(async () => {
    await ctxReload();
  }, [ctxReload]);

  // Keep filters ref in sync so SSE stats handler uses current values
  useEffect(() => {
    currentFiltersRef.current = { dateFrom, dateTo, assetClass, symbol };
  }, [dateFrom, dateTo, assetClass, symbol]);

  // SSE stream — live equity + positions every 5s, trade sync notifications
  useEffect(() => {
    if (!selectedAccount) return;
    const token = localStorage.getItem("analytica_token") ?? "";
    const es = new EventSource(
      `${API_BASE}/api/v1/trading/stream/${selectedAccount.id}?token=${encodeURIComponent(token)}`
    );

    es.addEventListener("live", (e: MessageEvent) => {
      try {
        const data = JSON.parse(e.data);
        if (data.equity != null) setLiveEquity(data.equity);
        if (Array.isArray(data.positions)) setOpenPositions(data.positions);
      } catch { /* ignore */ }
    });

    es.addEventListener("stats", () => {
      // New trades were synced — refresh with current active filters
      const { dateFrom: df, dateTo: dt, assetClass: ac, symbol: sym } = currentFiltersRef.current;
      fetchStats(selectedAccount, df, dt, ac, sym);
    });

    return () => es.close();
  }, [selectedAccount, fetchStats]);

  const handleSync = useCallback(async () => {
    if (!selectedAccount) return;
    setSyncLoading(true);
    const token = localStorage.getItem("analytica_token");
    try {
      await fetch(`${API_BASE}/api/v1/accounts/sync/${selectedAccount.id}`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
      });
      // Poll for trades and check for sync errors after 15s
      setTimeout(async () => {
        await reloadAccounts();
        fetchStats(selectedAccount, dateFrom, dateTo, assetClass, symbol);
        // Re-check total trades to exit sync screen if trades now exist
        const token2 = localStorage.getItem("analytica_token");
        fetch(`${API_BASE}/api/v1/trading/stats/${selectedAccount.id}`, {
          headers: token2 ? { Authorization: `Bearer ${token2}` } : {},
        }).then((r) => r.ok ? r.json() : null).then((s) => { if (s) { setTotalTradesEver(s.total_trades ?? 0); setOverallBalance(s.current_balance ?? null); } }).catch(() => {});
      }, 15000);
    } catch {} finally { setSyncLoading(false); }
  }, [selectedAccount, fetchStats, reloadAccounts, dateFrom, dateTo, assetClass, symbol]);

  return (
    <div className="relative w-full pb-20">
      <AnimatePresence mode="wait">
        {isLoading ? (
          <motion.div key="loading" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex flex-col items-center justify-center min-h-[60vh] gap-4">
             <div className="w-12 h-12 border-4 border-amber-500/10 border-t-amber-500 rounded-full animate-spin" />
             <p className="text-[10px] uppercase tracking-[0.3em] text-amber-500/50 font-bold animate-pulse">Analytica OS v1.0</p>
          </motion.div>
        ) : (
          <motion.div key="content" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6">
            <DateFilterBar availableSymbols={availableSymbols} onSync={handleSync} syncLoading={syncLoading} />

            {stats && (
              <>
                {totalTradesEver === 0 ? (
                  <div className="rounded-2xl border border-slate-700/40 bg-slate-900/40 p-10 flex flex-col items-center gap-6 max-w-sm mx-auto text-center">
                    <p className="text-sm font-bold text-white">Sincroniza tu historial</p>
                    {selectedAccount?.sync_error && (
                      <div className="w-full bg-red-500/10 border border-red-500/20 rounded-xl px-4 py-3 text-left">
                        <p className="text-[10px] font-bold text-red-400 uppercase tracking-widest mb-1">Error de sincronización</p>
                        <p className="text-xs text-red-300 break-words">{selectedAccount.sync_error}</p>
                      </div>
                    )}
                    <button onClick={handleSync} disabled={syncLoading} className="px-6 py-3 rounded-xl bg-amber-600 text-white text-[10px] font-bold uppercase tracking-widest">
                      {syncLoading ? "Sincronizando..." : "Reintentar sincronización"}
                    </button>
                  </div>
                ) : (
                  <div className="space-y-6">
                    <CollapsibleSection title="Sesiones de Mercado" defaultOpen>
                      <MarketSessions />
                    </CollapsibleSection>

                    <BalanceHero
                      currentBalance={overallBalance ?? stats.current_balance}
                      netProfit={stats.net_profit}
                      totalTrades={stats.total_trades}
                      currency={selectedAccount?.currency}
                      accountName={selectedAccount?.name}
                      equityCurve={equityCurve}
                      liveEquity={liveEquity}
                    />

                    <OpenPositions positions={openPositions} currency={selectedAccount?.currency} />

                    {/* Stats — 4 compact cards */}
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                      {[
                        { label: "Win Rate",      value: stats.win_rate != null ? `${stats.win_rate.toFixed(1)}%` : "—",         positive: stats.win_rate != null ? stats.win_rate >= 50 : null },
                        { label: "Profit Factor", value: stats.profit_factor?.toFixed(2) ?? "—",                                  positive: stats.profit_factor != null ? stats.profit_factor >= 1.5 : null },
                        { label: "R:R",           value: stats.rr_ratio?.toFixed(2) ?? "—",                                       positive: stats.rr_ratio != null ? stats.rr_ratio >= 1 : null },
                        { label: "Max Drawdown",  value: stats.max_drawdown_pct != null ? `${stats.max_drawdown_pct.toFixed(1)}%` : "—", positive: stats.max_drawdown_pct != null ? false : null },
                      ].map((card) => (
                        <div key={card.label} className="bg-white/5 border border-white/8 rounded-xl px-4 py-3">
                          <p className="text-[9px] font-bold text-slate-500 uppercase tracking-widest">{card.label}</p>
                          <p className={`text-xl font-bold mt-1 tabular-nums ${card.positive === true ? "text-emerald-400" : card.positive === false ? "text-red-400" : "text-slate-300"}`}>
                            {card.value}
                          </p>
                        </div>
                      ))}
                    </div>

                    <CollapsibleSection title="Análisis de Símbolos" subtitle="Rendimiento detallado por activo">
                      <SymbolTable data={symbolData} />
                      <AIAnalysisAudit accountId={selectedAccount?.id ?? ""} dateFrom={dateFrom} dateTo={dateTo} analysisType="symbols" label="Análisis IA — Pares y Entradas" />
                    </CollapsibleSection>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                       <CollapsibleSection title="Curva de Equity" subtitle="Evolución del Capital">
                          <EquityCurve data={equityCurve} currency={selectedAccount?.currency} />
                       </CollapsibleSection>
                       <CloseReasonChart tp_count={stats.tp_count} sl_count={stats.sl_count} manual_count={stats.manual_count} unknown_count={stats.unknown_count} manual_rate={stats.manual_rate || 0} />
                    </div>

                    <CollapsibleSection title="Métricas de Riesgo" subtitle="Drawdown, Expectancia y Rachas">
                      <Phase2Metrics {...stats} currency={selectedAccount?.currency} />
                    </CollapsibleSection>

                    <CollapsibleSection title="Dinámica de Sesiones" subtitle="PnL y Duración por Horario">
                      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                        <SessionChart data={sessionData} currency={selectedAccount?.currency} />
                        <HoldingTimeScatter data={tradesList} currency={selectedAccount?.currency} />
                      </div>
                      <AIAnalysisAudit accountId={selectedAccount?.id ?? ""} dateFrom={dateFrom} dateTo={dateTo} analysisType="sessions" label="Análisis IA — Sesiones" />
                    </CollapsibleSection>

                    <CollapsibleSection title="Mapa de Calor" subtitle="Distribución Horaria">
                      <HeatmapChart data={heatmapData} />
                      <AIAnalysisAudit accountId={selectedAccount?.id ?? ""} dateFrom={dateFrom} dateTo={dateTo} analysisType="heatmap" label="Análisis IA — Optimización Horaria" />
                    </CollapsibleSection>

                    <CollapsibleSection title="Avanzado" subtitle="Monte Carlo, Sharpe y Z-Score" defaultOpen={false}>
                      <Phase4Metrics {...stats} accountId={selectedAccount?.id ?? ""} apiBase={API_BASE} currency={selectedAccount?.currency} />
                      <CalendarView accountId={selectedAccount?.id ?? ""} apiBase={API_BASE} currency={selectedAccount?.currency} />
                    </CollapsibleSection>

                    <CollapsibleSection title="Historial de Operaciones" subtitle="Trades cerrados" defaultOpen={false}>
                      <TradeHistory accountId={selectedAccount?.id ?? ""} currency={selectedAccount?.currency} dateFrom={dateFrom} dateTo={dateTo} />
                    </CollapsibleSection>
                  </div>
                )}
              </>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
