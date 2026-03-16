"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Wallet, Plus, RefreshCw, CheckCircle, Clock, AlertCircle } from "lucide-react";
import Link from "next/link";
import { API_BASE } from "../../../config";

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

const typeLabel: Record<string, { label: string; color: string; icon: React.ElementType }> = {
  DIRECT: { label: "Conexión Directa", color: "text-emerald-400", icon: CheckCircle },
  PASSIVE: { label: "API Key", color: "text-amber-400", icon: Clock },
};

export default function AccountsPage() {
  const router = useRouter();
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [loading, setLoading] = useState(true);
  const [syncingId, setSyncingId] = useState<string | null>(null);
  const [syncMsg, setSyncMsg] = useState<Record<string, string>>({});

  useEffect(() => {
    const token = localStorage.getItem("analytica_token");
    if (!token) { router.replace("/login"); return; }
    fetch(`${API_BASE}/api/v1/accounts/`, { headers: { Authorization: `Bearer ${token}` } })
      .then((r) => (r.ok ? r.json() : []))
      .then((data: Account[]) => {
        const unique = data.filter((a, i, arr) => {
          const key =
            a.platform && a.broker_server && a.mt5_login
              ? `${a.platform}:${a.broker_server}:${a.mt5_login}`
              : a.id;
          return (
            arr.findIndex((b) => {
              const otherKey =
                b.platform && b.broker_server && b.mt5_login
                  ? `${b.platform}:${b.broker_server}:${b.mt5_login}`
                  : b.id;
              return otherKey === key;
            }) === i
          );
        });
        setAccounts(unique);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [router]);

  const handleSync = async (accountId: string) => {
    const token = localStorage.getItem("analytica_token");
    setSyncingId(accountId);
    setSyncMsg((prev) => ({ ...prev, [accountId]: "" }));
    try {
      const res = await fetch(`${API_BASE}/api/v1/accounts/sync/${accountId}`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      setSyncMsg((prev) => ({ ...prev, [accountId]: res.ok ? "Sincronización iniciada..." : (data?.detail ?? "Error") }));
    } catch {
      setSyncMsg((prev) => ({ ...prev, [accountId]: "Error de conexión" }));
    } finally {
      setSyncingId(null);
    }
  };

  return (
    <div className="space-y-6 pt-2">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-white tracking-tight">Cuentas MT5</h1>
          <p className="text-xs text-slate-500 mt-0.5">Administra tus cuentas conectadas</p>
        </div>
        <Link
          href="/connect"
          className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-gradient-to-r from-amber-600 to-amber-500 text-white text-xs font-bold uppercase tracking-widest hover:shadow-[0_0_20px_rgba(245,158,11,0.3)] transition-all"
        >
          <Plus size={13} />
          Agregar cuenta
        </Link>
      </div>

      {loading ? (
        <div className="flex items-center gap-3 py-8">
          <div className="w-4 h-4 border-2 border-t-amber-500 border-amber-500/20 rounded-full animate-spin" />
          <span className="text-xs text-slate-500">Cargando cuentas...</span>
        </div>
      ) : accounts.length === 0 ? (
        <div className="bg-slate-900/60 border border-white/5 rounded-xl p-10 flex flex-col items-center gap-4 text-center">
          <Wallet className="w-10 h-10 text-slate-600" />
          <div>
            <p className="text-sm font-bold text-white">Sin cuentas vinculadas</p>
            <p className="text-xs text-slate-500 mt-1">Conecta tu primera cuenta MT5 para empezar.</p>
          </div>
          <Link
            href="/connect"
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-400 text-xs font-bold uppercase tracking-widest hover:bg-amber-500/20 transition-all"
          >
            <Plus size={13} /> Conectar ahora
          </Link>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {accounts.map((acc) => {
            const typeInfo = typeLabel[acc.connection_type] ?? { label: acc.connection_type, color: "text-slate-400", icon: AlertCircle };
            const TypeIcon = typeInfo.icon;
            return (
              <div key={acc.id} className="bg-slate-900/60 border border-white/5 rounded-xl p-5 space-y-4">
                <div className="flex items-start justify-between">
                  <div>
                    <p className="text-sm font-bold text-white">{acc.name}</p>
                    <p className="text-[10px] text-slate-500 mt-0.5 font-mono">{acc.id.slice(0, 8)}…</p>
                  </div>
                  <div className={`flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-widest ${typeInfo.color}`}>
                    <TypeIcon size={12} />
                    {typeInfo.label}
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-3">
                  <div>
                    <p className="text-[9px] text-slate-500 uppercase tracking-widest">Plataforma</p>
                    <p className="text-xs font-bold text-white mt-0.5">{acc.platform}</p>
                  </div>
                  <div>
                    <p className="text-[9px] text-slate-500 uppercase tracking-widest">Moneda</p>
                    <p className="text-xs font-bold text-white mt-0.5">{acc.currency}</p>
                  </div>
                  <div>
                    <p className="text-[9px] text-slate-500 uppercase tracking-widest">Balance inicial</p>
                    <p className="text-xs font-bold text-white mt-0.5">
                      {acc.balance_initial > 0 ? `${acc.currency} ${acc.balance_initial.toLocaleString()}` : "—"}
                    </p>
                  </div>
                </div>

                {acc.connection_type === "DIRECT" && (
                  <div className="pt-2 border-t border-white/5 flex items-center justify-between">
                    <button
                      onClick={() => handleSync(acc.id)}
                      disabled={syncingId === acc.id}
                      className="flex items-center gap-1.5 text-[10px] font-bold text-amber-400 hover:text-amber-300 uppercase tracking-widest transition-colors disabled:opacity-50"
                    >
                      <RefreshCw size={11} className={syncingId === acc.id ? "animate-spin" : ""} />
                      {syncingId === acc.id ? "Sincronizando..." : "Sincronizar"}
                    </button>
                    {syncMsg[acc.id] && (
                      <span className="text-[10px] text-slate-400">{syncMsg[acc.id]}</span>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
