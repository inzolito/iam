"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import {
  TrendingUp,
  TrendingDown,
  Layers,
  Activity,
  Target,
  Lock,
  Eye,
  EyeOff,
  ShieldCheck,
  ArrowRight,
  RefreshCw,
} from "lucide-react";
import KpiCard from "../../components/dashboard/KpiCard";
import CloseReasonChart from "../../components/dashboard/CloseReasonChart";
import EquityCurve from "../../components/dashboard/EquityCurve";
import SymbolTable from "../../components/dashboard/SymbolTable";

const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

interface Account {
  id: string;
  name: string;
  platform: string;
  currency: string;
  balance_initial: number;
  connection_type: string;
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
}

interface EquityPoint {
  date: string;
  balance: number;
  daily_pl: number;
  trades_count: number;
}

interface SymbolRow {
  ticker: string;
  asset_class: string;
  total_trades: number;
  total_pnl: number;
  avg_pnl: number | null;
  win_rate: number | null;
}

function fmt(value: number | null | undefined, decimals = 2, prefix = "") {
  if (value === null || value === undefined) return null;
  return `${prefix}${Number(value).toFixed(decimals)}`;
}

function fmtCurrency(value: number | null | undefined, currency = "USD") {
  if (value === null || value === undefined) return null;
  const sign = value >= 0 ? "+" : "";
  return `${sign}${currency} ${Math.abs(value).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export default function DashboardPage() {
  const router = useRouter();
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [selectedAccount, setSelectedAccount] = useState<Account | null>(null);
  const [stats, setStats] = useState<Stats | null>(null);
  const [equityCurve, setEquityCurve] = useState<EquityPoint[]>([]);
  const [symbolData, setSymbolData] = useState<SymbolRow[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [statsLoading, setStatsLoading] = useState(false);
  // Inline investor password form (for PASSIVE accounts with 0 trades)
  const [inlinePassword, setInlinePassword] = useState("");
  const [showInlinePw, setShowInlinePw] = useState(false);
  const [inlineLoading, setInlineLoading] = useState(false);
  const [inlineError, setInlineError] = useState("");
  // Manual sync (for DIRECT accounts with 0 trades)
  const [syncLoading, setSyncLoading] = useState(false);
  const [syncResult, setSyncResult] = useState<{ synced: number } | null>(null);
  const [syncError, setSyncError] = useState("");

  // Fetch account list — redirect to /login if not authenticated, /connect if no accounts
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
        if (res.status === 401) {
          localStorage.removeItem("analytica_token");
          router.replace("/login");
          return;
        }
        if (res.ok) {
          const data: Account[] = await res.json();
          if (data.length === 0) {
            router.replace("/connect");
            return;
          }
          setAccounts(data);
          setSelectedAccount(data[0]);
        }
      } catch {
        // Backend unreachable — stay on dashboard, show loading state
      } finally {
        setIsLoading(false);
      }
    };
    load();
  }, [router]);

  // Fetch stats for selected account
  const fetchStats = useCallback(async (account: Account) => {
    setStatsLoading(true);
    const token = localStorage.getItem("analytica_token");
    const authHeader = token ? { Authorization: `Bearer ${token}` } : {};
    try {
      const [statsRes, equityRes, symbolRes] = await Promise.all([
        fetch(`${API_BASE}/api/v1/trading/stats/${account.id}`, { headers: authHeader }),
        fetch(`${API_BASE}/api/v1/trading/equity-curve/${account.id}`, { headers: authHeader }),
        fetch(`${API_BASE}/api/v1/trading/by-symbol/${account.id}`, { headers: authHeader }),
      ]);

      if (statsRes.ok) setStats(await statsRes.json());
      if (equityRes.ok) setEquityCurve(await equityRes.json());
      if (symbolRes.ok) setSymbolData(await symbolRes.json());
    } catch {
      // Silently handle — backend may be offline
    } finally {
      setStatsLoading(false);
    }
  }, []);

  useEffect(() => {
    if (selectedAccount) fetchStats(selectedAccount);
  }, [selectedAccount, fetchStats]);

  const handleSetPassword = useCallback(async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedAccount) return;
    setInlineError("");
    setInlineLoading(true);
    const token = localStorage.getItem("analytica_token");
    try {
      const res = await fetch(`${API_BASE}/api/v1/accounts/${selectedAccount.id}/investor-password`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ investor_password: inlinePassword }),
      });
      if (!res.ok) {
        const detail = await res.json().catch(() => null);
        throw new Error(detail?.detail ?? "Error al guardar la contraseña.");
      }
      // Promote account to DIRECT locally so spinner shows immediately
      const upgraded = { ...selectedAccount, connection_type: "DIRECT" };
      setSelectedAccount(upgraded);
      setAccounts((prev) => prev.map((a) => (a.id === upgraded.id ? upgraded : a)));
      setInlinePassword("");
    } catch (err) {
      setInlineError(err instanceof Error ? err.message : "Error inesperado.");
    } finally {
      setInlineLoading(false);
    }
  }, [selectedAccount, inlinePassword]);

  const syncPollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Stop polling when component unmounts
  useEffect(() => () => { if (syncPollRef.current) clearInterval(syncPollRef.current); }, []);

  const handleSync = useCallback(async () => {
    if (!selectedAccount) return;
    setSyncError("");
    setSyncResult(null);
    setSyncLoading(true);
    const token = localStorage.getItem("analytica_token");
    try {
      const res = await fetch(`${API_BASE}/api/v1/accounts/sync/${selectedAccount.id}`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.detail ?? "Error al sincronizar.");

      // Sync started in background — poll stats every 15s until trades appear (max 20 min)
      let attempts = 0;
      const maxAttempts = 80; // 80 × 15s = 20 min
      syncPollRef.current = setInterval(async () => {
        attempts++;
        try {
          const statsRes = await fetch(`${API_BASE}/api/v1/trading/stats/${selectedAccount.id}`, {
            headers: { Authorization: `Bearer ${token ?? ""}` },
          });
          if (statsRes.ok) {
            const statsData = await statsRes.json();
            if (statsData.total_trades > 0) {
              clearInterval(syncPollRef.current!);
              syncPollRef.current = null;
              setSyncLoading(false);
              setSyncResult({ synced: statsData.total_trades });
              await fetchStats(selectedAccount);
              return;
            }
          }
        } catch { /* ignore poll errors */ }
        if (attempts >= maxAttempts) {
          clearInterval(syncPollRef.current!);
          syncPollRef.current = null;
          setSyncLoading(false);
          setSyncError("La sincronización tardó demasiado. Intenta de nuevo más tarde.");
        }
      }, 15000);
    } catch (err) {
      if (err instanceof Error && err.name === "AbortError") return; // page navigated away
      setSyncError(err instanceof Error ? err.message : "Error inesperado.");
      setSyncLoading(false);
    }
  }, [selectedAccount, fetchStats]);

  return (
    <div className="relative w-full h-full">
      <AnimatePresence mode="wait">
        {isLoading ? (
          <motion.div
            key="loading"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="flex flex-col items-center justify-center min-h-[60vh] gap-4"
          >
            <div className="relative w-12 h-12">
              <div className="absolute inset-0 border-4 border-amber-500/10 rounded-full" />
              <div className="absolute inset-0 border-4 border-t-amber-500 rounded-full animate-spin" />
            </div>
            <p className="text-[10px] uppercase tracking-[0.3em] text-amber-500/50 font-bold animate-pulse">
              Iniciando Terminal...
            </p>
          </motion.div>
        ) : (
          <motion.div
            key="content"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.6, ease: "easeOut" }}
            className="w-full space-y-6"
          >
            <>
                {/* ── Zero-trades state ── */}
                {stats && stats.total_trades === 0 && (
                  selectedAccount?.connection_type === "DIRECT" ? (
                    /* DIRECT + no trades → manual sync trigger */
                    <motion.div
                      key="syncing"
                      initial={{ opacity: 0, y: -10 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="rounded-2xl border border-slate-700/40 bg-slate-900/40 p-10 flex flex-col items-center gap-6 max-w-sm mx-auto text-center"
                    >
                      <div className="relative w-14 h-14">
                        <div className="absolute inset-0 border-4 border-amber-500/10 rounded-full" />
                        <div className={`absolute inset-0 border-4 border-t-amber-500 rounded-full ${syncLoading ? "animate-spin" : "opacity-30"}`} />
                      </div>

                      <div className="space-y-1">
                        <p className="text-sm font-bold text-white">
                          {syncResult ? `${syncResult.synced} trades importados` : syncLoading ? "Conectando al broker..." : "Sin datos aún"}
                        </p>
                        <p className="text-xs text-slate-500 leading-relaxed">
                          {syncResult
                            ? "Historial sincronizado correctamente. Recargando métricas..."
                            : syncLoading
                            ? "MetaAPI está estableciendo conexión con tu broker. La primera vez puede tardar hasta 10 minutos — no cierres esta pestaña."
                            : "La cuenta está conectada. Lanza la primera sincronización para importar tu historial desde MetaAPI."}
                        </p>
                      </div>

                      {syncError && (
                        <p className="text-xs text-red-400 bg-red-500/8 border border-red-500/15 rounded-lg px-4 py-2.5 w-full text-left">
                          {syncError}
                        </p>
                      )}

                      <button
                        onClick={handleSync}
                        disabled={syncLoading}
                        className="flex items-center gap-2 px-5 py-3 rounded-xl bg-gradient-to-r from-amber-600 to-amber-500 text-white text-xs font-bold uppercase tracking-widest hover:shadow-[0_0_20px_rgba(245,158,11,0.3)] transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        <RefreshCw size={13} className={syncLoading ? "animate-spin" : ""} />
                        {syncLoading ? "Conectando..." : "Sincronizar ahora"}
                      </button>
                    </motion.div>
                  ) : (
                    /* PASSIVE + no trades → inline investor password form */
                    <motion.div
                      key="inline-pw"
                      initial={{ opacity: 0, y: -10 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="rounded-2xl border border-amber-500/15 bg-slate-900/40 p-8 max-w-md"
                    >
                      <div className="flex items-center gap-4 mb-6">
                        <div className="w-10 h-10 rounded-xl bg-amber-500/8 border border-amber-500/15 flex items-center justify-center flex-shrink-0">
                          <Lock className="w-5 h-5 text-amber-500" />
                        </div>
                        <div>
                          <p className="text-sm font-bold text-white">Completa la conexión</p>
                          <p className="text-xs text-slate-500 mt-0.5">
                            Añade tu Contraseña de Inversor para que Analytica empiece a leer tu historial.
                          </p>
                        </div>
                      </div>

                      <form onSubmit={handleSetPassword} className="space-y-4">
                        <div className="space-y-2">
                          <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest flex items-center gap-2">
                            <Lock size={10} className="text-amber-500/60" />
                            Contraseña de Inversor
                          </label>
                          <div className="relative">
                            <input
                              required
                              type={showInlinePw ? "text" : "password"}
                              placeholder="••••••••"
                              value={inlinePassword}
                              onChange={(e) => setInlinePassword(e.target.value)}
                              className="w-full bg-slate-950/50 border border-white/6 rounded-xl px-4 py-3.5 text-sm text-white placeholder:text-slate-600 focus:outline-none focus:border-amber-500/50 focus:ring-1 focus:ring-amber-500/20 transition-all font-medium pr-12"
                            />
                            <button
                              type="button"
                              onClick={() => setShowInlinePw((v) => !v)}
                              className="absolute right-3 top-1/2 -translate-y-1/2 p-2 rounded-lg hover:bg-white/8 transition-colors text-slate-500 hover:text-slate-300"
                            >
                              {showInlinePw ? <EyeOff size={15} /> : <Eye size={15} />}
                            </button>
                          </div>
                          <p className="text-[11px] text-slate-500 flex gap-2 items-start">
                            <ShieldCheck size={11} className="text-green-500/70 flex-shrink-0 mt-0.5" />
                            Solo lectura — imposible ejecutar órdenes con la Contraseña de Inversor.
                          </p>
                        </div>

                        {inlineError && (
                          <p className="text-xs text-red-400 bg-red-500/8 border border-red-500/15 rounded-lg px-4 py-2.5">
                            {inlineError}
                          </p>
                        )}

                        <button
                          type="submit"
                          disabled={inlineLoading}
                          className="flex items-center gap-2 px-5 py-3 rounded-xl bg-gradient-to-r from-amber-600 to-amber-500 text-white text-xs font-bold uppercase tracking-widest hover:shadow-[0_0_20px_rgba(245,158,11,0.3)] transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          {inlineLoading ? (
                            <motion.div
                              animate={{ rotate: 360 }}
                              transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
                              className="w-4 h-4 border-2 border-white/20 border-t-white rounded-full"
                            />
                          ) : (
                            <>Guardar y conectar <ArrowRight size={13} /></>
                          )}
                        </button>
                      </form>
                    </motion.div>
                  )
                )}

                {/* ── Analytics panels — only when there are trades ── */}
                {stats && stats.total_trades > 0 && (
                  <>
                    {/* Account selector */}
                    {accounts.length > 1 && (
                      <div className="flex gap-2">
                        {accounts.map((acc) => (
                          <button
                            key={acc.id}
                            onClick={() => setSelectedAccount(acc)}
                            className={`text-xs px-4 py-2 rounded-lg border transition-all duration-200 font-medium ${
                              selectedAccount?.id === acc.id
                                ? "border-amber-500/50 bg-amber-500/5 text-amber-400"
                                : "border-white/5 bg-slate-900/40 text-slate-400 hover:border-white/10 hover:text-white"
                            }`}
                          >
                            {acc.name}
                          </button>
                        ))}
                      </div>
                    )}

                    {statsLoading ? (
                      <div className="flex items-center gap-3 py-4">
                        <div className="w-4 h-4 border-2 border-t-amber-500 border-amber-500/20 rounded-full animate-spin" />
                        <span className="text-[10px] text-slate-500 uppercase tracking-widest">Cargando estadísticas...</span>
                      </div>
                    ) : (
                      <>
                        {/* ── KPI Row 1 ── */}
                        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
                          <KpiCard
                            label="Net Profit"
                            value={fmtCurrency(stats.net_profit, selectedAccount?.currency)}
                            color={stats.net_profit > 0 ? "green" : stats.net_profit < 0 ? "red" : "default"}
                            icon={stats.net_profit >= 0 ? TrendingUp : TrendingDown}
                          />
                          <KpiCard
                            label="Win Rate"
                            value={stats.win_rate != null ? `${fmt(stats.win_rate, 1)}%` : "—"}
                            color={stats.win_rate != null ? (stats.win_rate >= 50 ? "green" : "red") : "default"}
                            icon={Target}
                            subValue={`${stats.total_trades} operaciones`}
                          />
                          <KpiCard
                            label="Ganancia Prom."
                            value={stats.avg_win != null ? `+${selectedAccount?.currency} ${Number(stats.avg_win).toFixed(2)}` : "—"}
                            color="green"
                            icon={TrendingUp}
                            badge={stats.rr_ratio != null ? `R:R ${Number(stats.rr_ratio).toFixed(2)}` : undefined}
                            badgeColor="amber"
                          />
                          <KpiCard
                            label="Pérdida Prom."
                            value={stats.avg_loss != null ? `${selectedAccount?.currency} ${Number(stats.avg_loss).toFixed(2)}` : "—"}
                            color="red"
                            icon={TrendingDown}
                          />
                          <KpiCard
                            label="Volumen Total"
                            value={stats.total_volume_lots != null ? `${Number(stats.total_volume_lots).toFixed(2)} lotes` : "—"}
                            icon={Layers}
                          />
                          <KpiCard
                            label="Trades Manuales"
                            value={`${stats.manual_count}`}
                            subValue={stats.manual_rate != null ? `${Number(stats.manual_rate).toFixed(1)}% del total` : undefined}
                            color={
                              stats.manual_rate != null
                                ? stats.manual_rate > 60 ? "red" : stats.manual_rate > 40 ? "amber" : "default"
                                : "default"
                            }
                            icon={Activity}
                          />
                        </div>

                        {/* ── Row 2: Equity Curve + TP/SL Chart ── */}
                        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                          <div className="lg:col-span-2">
                            <EquityCurve
                              data={equityCurve}
                              balanceInitial={selectedAccount?.balance_initial ?? 0}
                              currency={selectedAccount?.currency}
                            />
                          </div>
                          <CloseReasonChart
                            tp_count={stats.tp_count}
                            sl_count={stats.sl_count}
                            manual_count={stats.manual_count}
                            unknown_count={stats.unknown_count}
                            manual_rate={stats.manual_rate ?? null}
                          />
                        </div>

                        {/* ── Row 3: Symbol Table ── */}
                        <SymbolTable data={symbolData} />
                      </>
                    )}
                  </>
                )}
            </>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
