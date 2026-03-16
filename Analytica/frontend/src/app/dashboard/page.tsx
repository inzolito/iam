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
  RefreshCw,
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
import DateFilterBar from "../../components/dashboard/DateFilterBar";
import CollapsibleSection from "../../components/dashboard/CollapsibleSection";
import AIAnalysisAudit from "../../components/dashboard/AIAnalysisAudit";
import { useDateFilter } from "../../contexts/DateFilterContext";
import { API_BASE } from "../../config";

interface Account {
  id: string;
  name: string;
  platform: string;
  currency: string;
  balance_initial: number;
  connection_type: string;
  broker_server?: string | null;
  mt5_login?: string | null;
}

interface Stats {
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
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [selectedAccount, setSelectedAccount] = useState<Account | null>(null);
  const [stats, setStats] = useState<Stats | null>(null);
  const [equityCurve, setEquityCurve] = useState<EquityPoint[]>([]);
  const [symbolData, setSymbolData] = useState<SymbolRow[]>([]);
  const [sessionData, setSessionData] = useState<SessionRow[]>([]);
  const [tradesList, setTradesList] = useState<TradeRow[]>([]);
  const [heatmapData, setHeatmapData] = useState<HeatmapCell[]>([]);
  const [correlationData, setCorrelationData] = useState<{symbols: string[]; matrix: {symbol_a:string; symbol_b:string; correlation:number; trades_a:number; trades_b:number}[]}>({symbols:[], matrix:[]});
  const [liveEquity, setLiveEquity] = useState<number | null>(null);
  const [openPositions, setOpenPositions] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [statsLoading, setStatsLoading] = useState(false);
  const [hasTradesOverall, setHasTradesOverall] = useState(false);
  
  const [inlinePassword, setInlinePassword] = useState("");
  const [showInlinePw, setShowInlinePw] = useState(false);
  const [inlineLoading, setInlineLoading] = useState(false);
  const [inlineError, setInlineError] = useState("");
  const [syncLoading, setSyncLoading] = useState(false);
  const [syncError, setSyncError] = useState("");

  const { dateFrom, dateTo } = useDateFilter();

  useEffect(() => {
    const load = async () => {
      const token = localStorage.getItem("analytica_token");
      if (!token) {
        router.replace("/login");
        return;
      }
      try {
        const res = await fetch(`${API_BASE}/api/v1/accounts/`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (res.ok) {
          const raw: Account[] = await res.json();
          const data = raw.filter((a, i, arr) => {
            const key = a.platform && a.broker_server && a.mt5_login ? `${a.platform}:${a.broker_server}:${a.mt5_login}` : a.id;
            return arr.findIndex((b) => (b.platform && b.broker_server && b.mt5_login ? `${b.platform}:${b.broker_server}:${b.mt5_login}` : b.id) === key) === i;
          });
          if (data.length === 0) {
            router.replace("/connect");
            return;
          }
          setAccounts(data);
          setSelectedAccount(data[0]);
        }
      } catch {
      } finally {
        setIsLoading(false);
      }
    };
    load();
  }, [router]);

  const fetchStats = useCallback(async (account: Account, dFrom: string | null = null, dTo: string | null = null) => {
    setStatsLoading(true);
    const token = localStorage.getItem("analytica_token");
    const authHeader = token ? { Authorization: `Bearer ${token}` } : {};
    const qs = new URLSearchParams();
    if (dFrom) qs.append("date_from", dFrom);
    if (dTo) qs.append("date_to", dTo);
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

      if (statsRes.ok) {
        const s = await statsRes.json();
        setStats(s);
        // Check if account has trades overall once per period or sync
        if (s.total_trades > 0) setHasTradesOverall(true);
      }
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
    if (selectedAccount) fetchStats(selectedAccount, dateFrom, dateTo);
  }, [selectedAccount, fetchStats, dateFrom, dateTo]);

  // Sync logic simplified for brevity
  const handleSync = useCallback(async () => {
    if (!selectedAccount) return;
    setSyncLoading(true);
    const token = localStorage.getItem("analytica_token");
    try {
      await fetch(`${API_BASE}/api/v1/accounts/sync/${selectedAccount.id}`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
      });
      // Poll until trades appear (simplified)
      setTimeout(() => fetchStats(selectedAccount, dateFrom, dateTo), 5000);
    } catch {} finally { setSyncLoading(false); }
  }, [selectedAccount, fetchStats, dateFrom, dateTo]);

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
            <DateFilterBar />
            
            {accounts.length > 1 && (
              <div className="flex gap-2 mb-4 overflow-x-auto pb-2">
                {accounts.map((acc) => (
                  <button
                    key={acc.id}
                    onClick={() => setSelectedAccount(acc)}
                    className={`text-[9px] uppercase tracking-widest px-4 py-2 rounded-lg border transition-all font-bold ${
                      selectedAccount?.id === acc.id ? "border-amber-500/50 bg-amber-500/5 text-amber-400" : "border-white/5 bg-slate-900/40 text-slate-500 hover:text-white"
                    }`}
                  >
                    {acc.name}
                  </button>
                ))}
              </div>
            )}

            {stats && (
              <>
                {stats.total_trades === 0 && !hasTradesOverall ? (
                  <div className="rounded-2xl border border-slate-700/40 bg-slate-900/40 p-10 flex flex-col items-center gap-6 max-w-sm mx-auto text-center">
                    <p className="text-sm font-bold text-white">Sincroniza tu historial</p>
                    <button onClick={handleSync} disabled={syncLoading} className="px-6 py-3 rounded-xl bg-amber-600 text-white text-[10px] font-bold uppercase tracking-widest">
                      {syncLoading ? "Sincronizando..." : "Conectar MetaAPI"}
                    </button>
                  </div>
                ) : (
                  <div className="space-y-6">
                    <BalanceHero
                      balanceInitial={selectedAccount?.balance_initial ?? 0}
                      netProfit={stats.net_profit}
                      totalTrades={stats.total_trades}
                      currency={selectedAccount?.currency}
                      accountName={selectedAccount?.name}
                      equityCurve={equityCurve}
                      liveEquity={liveEquity}
                    />

                    <OpenPositions positions={openPositions} currency={selectedAccount?.currency} />

                    <CollapsibleSection title="Estadísticas Clave" subtitle="Métricas Fundamentales de Rentabilidad" badge={stats.total_trades}>
                      <div className="rounded-xl border border-white/5 bg-slate-900/40 divide-y divide-white/5">
                        {[
                          { label: "Win Rate", value: `${stats.win_rate?.toFixed(1)}%`, pos: stats.win_rate ? stats.win_rate >= 50 : undefined },
                          { label: "Profit Factor", value: stats.profit_factor?.toFixed(2) || "—", pos: stats.profit_factor ? stats.profit_factor >= 1.5 : undefined },
                          { label: "R:R Ratio", value: stats.rr_ratio?.toFixed(2) || "—", pos: stats.rr_ratio ? stats.rr_ratio >= 1 : undefined },
                          { label: "Max Drawdown", value: `${stats.max_drawdown_pct?.toFixed(1)}%`, pos: false },
                        ].map((row) => (
                          <div key={row.label} className="flex items-center justify-between px-5 py-3">
                            <span className="text-[10px] uppercase tracking-widest font-bold text-slate-500">{row.label}</span>
                            <span className={`text-sm font-bold ${row.pos === true ? "text-emerald-400" : row.pos === false ? "text-red-400" : "text-slate-300"}`}>{row.value}</span>
                          </div>
                        ))}
                      </div>
                    </CollapsibleSection>

                    <CollapsibleSection title="Análisis de Símbolos" subtitle="Rendimiento detallado por activo">
                      <SymbolTable data={symbolData} />
                      <AIAnalysisAudit accountId={selectedAccount?.id ?? ""} dateFrom={dateFrom} dateTo={dateTo} label="Auditoría IA de Portafolio" />
                    </CollapsibleSection>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                       <CollapsibleSection title="Curva de Equity" subtitle="Evolución del Capital">
                          <EquityCurve data={equityCurve} balanceInitial={selectedAccount?.balance_initial ?? 0} currency={selectedAccount?.currency} />
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
                      <AIAnalysisAudit accountId={selectedAccount?.id ?? ""} dateFrom={dateFrom} dateTo={dateTo} label="Auditoría IA de Sesiones" />
                    </CollapsibleSection>

                    <CollapsibleSection title="Mapa de Calor" subtitle="Distribución Horaria">
                      <HeatmapChart data={heatmapData} />
                      <AIAnalysisAudit accountId={selectedAccount?.id ?? ""} dateFrom={dateFrom} dateTo={dateTo} label="Consultar IA de Optimización" />
                    </CollapsibleSection>

                    <CollapsibleSection title="Avanzado" subtitle="Monte Carlo, Sharpe y Z-Score" defaultOpen={false}>
                      <Phase4Metrics {...stats} accountId={selectedAccount?.id ?? ""} apiBase={API_BASE} currency={selectedAccount?.currency} />
                      <CalendarView accountId={selectedAccount?.id ?? ""} apiBase={API_BASE} currency={selectedAccount?.currency} />
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
