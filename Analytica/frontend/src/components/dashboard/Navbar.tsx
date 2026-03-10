"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { User, Bell, Search, LogOut, Menu, CheckCircle, Circle } from "lucide-react";

const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

interface NavbarProps {
  onMenuToggle: () => void;
}

export default function Navbar({ onMenuToggle }: NavbarProps) {
  const router = useRouter();
  const [menuOpen, setMenuOpen] = useState(false);
  const [accountName, setAccountName] = useState<string | null>(null);
  const [hasAccount, setHasAccount] = useState(false);

  useEffect(() => {
    const token = localStorage.getItem("analytica_token");
    if (!token) return;
    fetch(`${API_BASE}/api/v1/accounts/`, { headers: { Authorization: `Bearer ${token}` } })
      .then((r) => r.ok ? r.json() : [])
      .then((accounts: { name: string }[]) => {
        if (accounts.length > 0) {
          setHasAccount(true);
          setAccountName(accounts[0].name);
        }
      })
      .catch(() => {});
  }, []);

  const handleLogout = () => {
    localStorage.removeItem("analytica_token");
    router.replace("/login");
  };

  return (
    <header className="fixed top-0 right-0 left-0 lg:left-64 h-16 bg-slate-950/80 backdrop-blur-xl border-b border-white/5 z-40 px-4 md:px-6 lg:px-10 flex items-center justify-between gap-4">
      {/* Hamburger — mobile only */}
      <button
        onClick={onMenuToggle}
        className="lg:hidden p-2 rounded-lg text-slate-400 hover:text-white hover:bg-white/5 transition-colors flex-shrink-0"
        aria-label="Abrir menú"
      >
        <Menu size={20} />
      </button>

      {/* Search */}
      <div className="hidden sm:flex items-center gap-4 bg-white/5 border border-white/5 px-4 py-2 rounded-full w-72 xl:w-96 transition-all duration-300 focus-within:border-amber-500/50 focus-within:bg-white/10 group">
        <Search className="w-4 h-4 text-slate-500 group-focus-within:text-amber-500 transition-colors flex-shrink-0" />
        <input
          type="text"
          placeholder="Buscar métricas o activos..."
          className="bg-transparent border-none outline-none text-xs text-slate-300 w-full placeholder:text-slate-600"
        />
      </div>

      <div className="flex items-center gap-4 md:gap-6 ml-auto">
        <button className="relative text-slate-500 hover:text-amber-500 transition-all duration-300">
          <Bell className="w-5 h-5" />
          <span className="absolute -top-1 -right-1 w-2 h-2 bg-amber-500 rounded-full border-2 border-slate-950" />
        </button>

        <div className="flex items-center gap-3 pl-4 md:pl-6 border-l border-white/5">
          <div className="text-right hidden sm:block">
            <p className="text-sm font-bold text-white tracking-wide leading-tight">
              {accountName ?? "Analytica"}
            </p>
            <div className="flex items-center gap-1.5 justify-end mt-0.5">
              {hasAccount ? (
                <CheckCircle className="w-2.5 h-2.5 text-emerald-500" />
              ) : (
                <Circle className="w-2.5 h-2.5 text-slate-600" />
              )}
              <p className={`text-[9px] font-bold uppercase tracking-widest ${hasAccount ? "text-emerald-500" : "text-slate-500"}`}>
                {hasAccount ? "Cuenta vinculada" : "Sin cuenta"}
              </p>
            </div>
          </div>

          {/* User icon + dropdown */}
          <div className="relative">
            <button
              onClick={() => setMenuOpen((v) => !v)}
              className="w-9 h-9 rounded-full bg-gradient-to-br from-slate-800 to-slate-950 border border-white/10 flex items-center justify-center overflow-hidden shadow-lg shadow-black/50 hover:border-amber-500/50 transition-all duration-300"
            >
              <User className="w-5 h-5 text-slate-400" />
            </button>

            {menuOpen && (
              <>
                <div className="fixed inset-0 z-10" onClick={() => setMenuOpen(false)} />
                <div className="absolute right-0 mt-2 w-44 bg-slate-900 border border-white/8 rounded-xl shadow-2xl shadow-black/60 z-20 overflow-hidden">
                  <button
                    onClick={handleLogout}
                    className="w-full flex items-center gap-3 px-4 py-3 text-xs text-slate-300 hover:bg-white/5 hover:text-red-400 transition-colors"
                  >
                    <LogOut className="w-4 h-4" />
                    Cerrar sesión
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </header>
  );
}
