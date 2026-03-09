"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { User, Bell, Search, LogOut } from "lucide-react";

export default function Navbar() {
  const router = useRouter();
  const [menuOpen, setMenuOpen] = useState(false);

  const handleLogout = () => {
    localStorage.removeItem("analytica_token");
    router.replace("/login");
  };

  return (
    <header className="fixed top-0 right-0 left-64 h-20 bg-slate-950/80 backdrop-blur-xl border-b border-white/5 z-40 px-10 flex items-center justify-between">
      <div className="flex items-center gap-4 bg-white/5 border border-white/5 px-5 py-2 rounded-full w-96 transition-all duration-300 focus-within:border-amber-500/50 focus-within:bg-white/10 group">
        <Search className="w-4 h-4 text-slate-500 group-focus-within:text-amber-500 transition-colors" />
        <input
          type="text"
          placeholder="Buscar métricas o activos..."
          className="bg-transparent border-none outline-none text-xs text-slate-300 w-full placeholder:text-slate-600"
        />
      </div>

      <div className="flex items-center gap-8">
        <button className="relative text-slate-500 hover:text-amber-500 transition-all duration-300">
          <Bell className="w-5 h-5" />
          <span className="absolute -top-1 -right-1 w-2 h-2 bg-amber-500 rounded-full border-2 border-slate-950"></span>
        </button>

        <div className="flex items-center gap-4 pl-8 border-l border-white/5">
          <div className="text-right hidden sm:block">
            <p className="text-sm font-bold text-white tracking-wide">msalas</p>
            <div className="flex items-center gap-1.5 justify-end mt-0.5">
              <span className="w-1.5 h-1.5 bg-slate-500 rounded-full"></span>
              <p className="text-[9px] font-bold text-slate-500 uppercase tracking-widest">Cuenta no vinculada</p>
            </div>
          </div>

          {/* User icon + dropdown */}
          <div className="relative">
            <button
              onClick={() => setMenuOpen((v) => !v)}
              className="w-10 h-10 rounded-full bg-gradient-to-br from-slate-800 to-slate-950 border border-white/10 flex items-center justify-center overflow-hidden shadow-lg shadow-black/50 hover:border-amber-500/50 transition-all duration-300"
            >
              <User className="w-6 h-6 text-slate-400" />
            </button>

            {menuOpen && (
              <>
                {/* Backdrop */}
                <div className="fixed inset-0 z-10" onClick={() => setMenuOpen(false)} />
                {/* Menu */}
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
