"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import {
  Server,
  Hash,
  ArrowRight,
  CheckCircle2,
  ShieldCheck,
  Eye,
  EyeOff,
  Lock,
  ChevronDown,
  Loader2,
} from "lucide-react";
import ConstellationBackground from "../../components/ConstellationBackground";

const API_BASE =
  process.env.NEXT_PUBLIC_API_URL ??
  "https://analytica-backend-419965139801.us-central1.run.app";

const inputClass =
  "w-full bg-slate-950/50 border border-white/6 rounded-xl px-4 py-3.5 text-sm text-white placeholder:text-slate-600 focus:outline-none focus:border-amber-500/50 focus:ring-1 focus:ring-amber-500/20 transition-all font-medium";

// ── Server Autocomplete ────────────────────────────────────────────────────────

function ServerAutocomplete({
  value,
  onChange,
}: {
  value: string;
  onChange: (v: string) => void;
}) {
  const [query, setQuery] = useState(value);
  const [results, setResults] = useState<string[]>([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [selected, setSelected] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const wrapperRef = useRef<HTMLDivElement>(null);

  // Fetch results with debounce
  const fetchServers = useCallback(async (q: string) => {
    setLoading(true);
    try {
      const token = localStorage.getItem("analytica_token") ?? "";
      const res = await fetch(
        `${API_BASE}/api/v1/accounts/broker-servers?query=${encodeURIComponent(q)}`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      if (res.ok) setResults(await res.json());
    } catch {
      // silently ignore
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (selected) return; // don't re-fetch after selection
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => fetchServers(query), 280);
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current); };
  }, [query, fetchServers, selected]);

  // Close on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const handleSelect = (server: string) => {
    setQuery(server);
    onChange(server);
    setSelected(true);
    setOpen(false);
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setQuery(e.target.value);
    onChange(e.target.value);
    setSelected(false);
    setOpen(true);
  };

  const handleFocus = () => {
    setOpen(true);
    if (!selected) fetchServers(query);
  };

  return (
    <div ref={wrapperRef} className="relative">
      <div className="relative">
        <input
          required
          type="text"
          placeholder="Busca tu broker..."
          value={query}
          onChange={handleInputChange}
          onFocus={handleFocus}
          autoComplete="off"
          className={`${inputClass} pr-10`}
        />
        <div className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 pointer-events-none">
          {loading
            ? <Loader2 size={14} className="animate-spin" />
            : <ChevronDown size={14} className={`transition-transform duration-200 ${open ? "rotate-180" : ""}`} />
          }
        </div>
      </div>

      <AnimatePresence>
        {open && results.length > 0 && (
          <motion.ul
            initial={{ opacity: 0, y: -6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
            transition={{ duration: 0.15 }}
            className="absolute z-50 mt-1.5 w-full bg-slate-900 border border-white/10 rounded-xl shadow-2xl shadow-black/60 overflow-hidden max-h-52 overflow-y-auto"
          >
            {results.map((server) => (
              <li key={server}>
                <button
                  type="button"
                  onMouseDown={() => handleSelect(server)}
                  className={`w-full text-left px-4 py-2.5 text-sm transition-colors font-medium ${
                    server === value
                      ? "bg-amber-500/15 text-amber-300"
                      : "text-slate-300 hover:bg-white/6 hover:text-white"
                  }`}
                >
                  {server}
                </button>
              </li>
            ))}
          </motion.ul>
        )}
      </AnimatePresence>
    </div>
  );
}

// ── Page ───────────────────────────────────────────────────────────────────────

export default function ConnectPage() {
  const router = useRouter();

  const [accountNumber, setAccountNumber] = useState("");
  const [brokerServer, setBrokerServer] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [balanceInitial, setBalanceInitial] = useState("");

  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!brokerServer) { setError("Selecciona un servidor del broker."); return; }
    setError("");
    setIsLoading(true);
    try {
      const token = localStorage.getItem("analytica_token");
      if (!token) { router.replace("/login"); return; }
      const res = await fetch(`${API_BASE}/api/v1/accounts/link-direct`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          account_number: accountNumber,
          broker_server: brokerServer,
          investor_password: password,
          currency: "USD",
          balance_initial: balanceInitial ? parseFloat(balanceInitial) : 0,
        }),
      });
      if (!res.ok) {
        const detail = await res.json().catch(() => null);
        throw new Error(detail?.detail ?? "Error al vincular la cuenta.");
      }
      setSuccess(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error inesperado.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 flex items-center justify-center p-4 relative overflow-hidden">
      <ConstellationBackground />
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[700px] h-[700px] bg-amber-500/4 rounded-full blur-[140px] pointer-events-none" />

      <AnimatePresence mode="wait">
        {!success ? (
          <motion.div
            key="form"
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -24 }}
            transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
            className="relative z-10 w-full max-w-md"
          >
            <div className="text-center mb-10">
              <p className="text-[10px] font-bold text-amber-500/60 uppercase tracking-[0.4em]">
                ANALYTICA
              </p>
            </div>

            <div className="bg-slate-900/40 backdrop-blur-2xl border border-white/8 rounded-2xl overflow-hidden shadow-2xl shadow-black/60">
              <div className="px-8 pt-8 pb-6 border-b border-white/5">
                <div className="flex items-center gap-4">
                  <div className="w-11 h-11 rounded-xl bg-amber-500/8 border border-amber-500/15 flex items-center justify-center flex-shrink-0">
                    <Lock className="w-5 h-5 text-amber-500" />
                  </div>
                  <div>
                    <h1 className="text-xl font-bold text-white tracking-tight">
                      Conecta tu cuenta MT5
                    </h1>
                    <p className="text-[11px] text-slate-500 mt-0.5 font-medium">
                      Conexión de solo lectura · Sin ejecución de órdenes
                    </p>
                  </div>
                </div>
              </div>

              <form onSubmit={handleSubmit} className="px-8 py-7 space-y-5">
                {/* Account number */}
                <div className="space-y-2">
                  <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest flex items-center gap-2">
                    <Hash size={11} className="text-amber-500/60" />
                    Número de cuenta MT5
                  </label>
                  <input
                    required
                    type="text"
                    inputMode="numeric"
                    placeholder="12345678"
                    value={accountNumber}
                    onChange={(e) => setAccountNumber(e.target.value)}
                    className={inputClass}
                  />
                </div>

                {/* Broker server autocomplete */}
                <div className="space-y-2">
                  <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest flex items-center gap-2">
                    <Server size={11} className="text-amber-500/60" />
                    Servidor del broker
                  </label>
                  <ServerAutocomplete value={brokerServer} onChange={setBrokerServer} />
                </div>

                {/* Investor password */}
                <div className="space-y-2">
                  <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest flex items-center gap-2">
                    <Lock size={11} className="text-amber-500/60" />
                    Contraseña de Inversor
                  </label>
                  <div className="relative">
                    <input
                      required
                      type={showPassword ? "text" : "password"}
                      placeholder="••••••••"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      className={`${inputClass} pr-12`}
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword((v) => !v)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 p-2 rounded-lg hover:bg-white/8 transition-colors text-slate-500 hover:text-slate-300"
                      title={showPassword ? "Ocultar" : "Mostrar"}
                    >
                      {showPassword ? <EyeOff size={15} /> : <Eye size={15} />}
                    </button>
                  </div>
                  <p className="text-[11px] text-slate-500 leading-relaxed flex gap-2 items-start pt-1">
                    <ShieldCheck size={12} className="text-green-500/70 flex-shrink-0 mt-0.5" />
                    Solo usamos la Contraseña de Inversor — acceso de solo lectura. Imposible ejecutar órdenes con ella.
                  </p>
                </div>

                {/* Initial balance */}
                <div className="space-y-2">
                  <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest flex items-center gap-2">
                    <Hash size={11} className="text-amber-500/60" />
                    Balance inicial (USD) <span className="text-slate-600 normal-case font-normal">— opcional</span>
                  </label>
                  <input
                    type="number"
                    inputMode="decimal"
                    min="0"
                    step="0.01"
                    placeholder="10000.00"
                    value={balanceInitial}
                    onChange={(e) => setBalanceInitial(e.target.value)}
                    className={inputClass}
                  />
                  <p className="text-[11px] text-slate-500 leading-relaxed">
                    Se usa para calcular el punto de inicio en la Equity Curve.
                  </p>
                </div>

                <AnimatePresence>
                  {error && (
                    <motion.p
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: "auto" }}
                      exit={{ opacity: 0, height: 0 }}
                      className="text-xs text-red-400 bg-red-500/8 border border-red-500/15 rounded-lg px-4 py-2.5"
                    >
                      {error}
                    </motion.p>
                  )}
                </AnimatePresence>

                <button
                  type="submit"
                  disabled={isLoading}
                  className="w-full relative group overflow-hidden rounded-xl bg-gradient-to-r from-amber-600 to-amber-500 p-px transition-all duration-300 hover:shadow-[0_0_28px_rgba(245,158,11,0.35)] disabled:opacity-50 disabled:cursor-not-allowed mt-2"
                >
                  <div className="bg-slate-950 rounded-[11px] py-4 flex items-center justify-center gap-3 transition-colors duration-300 group-hover:bg-transparent group-disabled:bg-slate-950">
                    {isLoading ? (
                      <motion.div
                        animate={{ rotate: 360 }}
                        transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
                        className="w-5 h-5 border-2 border-white/20 border-t-white rounded-full"
                      />
                    ) : (
                      <>
                        <span className="text-white font-bold uppercase tracking-widest text-xs">
                          Vincular cuenta
                        </span>
                        <ArrowRight size={14} className="text-white/70" />
                      </>
                    )}
                  </div>
                </button>
              </form>

              <div className="px-8 pb-6 text-center">
                <p className="text-[9px] text-slate-600 uppercase tracking-widest">
                  Contraseña cifrada con AES-256-GCM · Nunca se transmite en respuestas
                </p>
              </div>
            </div>
          </motion.div>
        ) : (
          <motion.div
            key="success"
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -24 }}
            transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
            className="relative z-10 w-full max-w-md"
          >
            <div className="text-center mb-10">
              <p className="text-[10px] font-bold text-amber-500/60 uppercase tracking-[0.4em]">
                ANALYTICA
              </p>
            </div>

            <div className="bg-slate-900/40 backdrop-blur-2xl border border-white/8 rounded-2xl overflow-hidden shadow-2xl shadow-black/60">
              <div className="px-8 pt-8 pb-6 border-b border-white/5 bg-gradient-to-r from-green-500/4 to-transparent">
                <div className="flex items-center gap-4">
                  <div className="w-11 h-11 rounded-xl bg-green-500/10 border border-green-500/20 flex items-center justify-center flex-shrink-0">
                    <CheckCircle2 className="w-5 h-5 text-green-400" />
                  </div>
                  <div>
                    <h1 className="text-xl font-bold text-white tracking-tight">Cuenta vinculada</h1>
                    <p className="text-[11px] text-slate-500 mt-0.5 font-medium">Conexión Directa activa</p>
                  </div>
                </div>
              </div>

              <div className="px-8 py-8 space-y-5">
                <div className="bg-green-500/6 border border-green-500/15 rounded-xl px-5 py-4 space-y-2">
                  <div className="flex items-center gap-2">
                    <ShieldCheck size={14} className="text-green-400" />
                    <p className="text-sm font-semibold text-green-300">Contraseña almacenada de forma segura</p>
                  </div>
                  <p className="text-xs text-slate-400 leading-relaxed">
                    La Contraseña de Inversor fue cifrada con AES-256-GCM y almacenada. No se transmite ni se muestra nuevamente.
                  </p>
                </div>

                <div className="bg-slate-950/40 border border-white/5 rounded-xl px-5 py-4 space-y-2">
                  <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">¿Qué pasa ahora?</p>
                  <p className="text-xs text-slate-400 leading-relaxed">
                    Analytica leerá automáticamente tu historial de operaciones. No necesitas instalar ningún EA. Los datos comenzarán a aparecer en tu dashboard en los próximos minutos.
                  </p>
                </div>

                <button
                  onClick={() => router.push("/dashboard")}
                  className="w-full relative group overflow-hidden rounded-xl bg-gradient-to-r from-amber-600 to-amber-500 p-px transition-all duration-300 hover:shadow-[0_0_28px_rgba(245,158,11,0.35)]"
                >
                  <div className="bg-slate-950 rounded-[11px] py-4 flex items-center justify-center gap-3 transition-colors duration-300 group-hover:bg-transparent">
                    <span className="text-white font-bold uppercase tracking-widest text-xs">Ir al Dashboard</span>
                    <ArrowRight size={14} className="text-white/70" />
                  </div>
                </button>
              </div>

              <div className="px-8 pb-5 text-center">
                <p className="text-[9px] text-slate-600 uppercase tracking-widest">
                  Conexión Directa Analytica · Acceso de solo lectura
                </p>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
