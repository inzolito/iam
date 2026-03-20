"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { User, Bell, Search, LogOut, Menu, ChevronDown, CheckCircle } from "lucide-react";
import { useTheme } from "../../contexts/ThemeContext";
import { useAccount } from "../../contexts/AccountContext";

interface NavbarProps {
  onMenuToggle: () => void;
}

export default function Navbar({ onMenuToggle }: NavbarProps) {
  const router    = useRouter();
  const { theme } = useTheme();
  const { accounts, selectedAccount, setSelectedAccount } = useAccount();
  const [menuOpen, setMenuOpen] = useState(false);

  const handleLogout = () => {
    localStorage.removeItem("analytica_token");
    router.replace("/login");
  };

  const handleSelectAccount = (acc: typeof accounts[0]) => {
    setSelectedAccount(acc);
    setMenuOpen(false);
  };

  return (
    <header className={`fixed top-0 right-0 left-0 lg:left-64 h-16 backdrop-blur-xl border-b z-40 px-4 md:px-6 lg:px-10 flex items-center justify-between gap-4 ${theme === "light" ? "bg-white/80 border-slate-200" : "bg-slate-950/80 border-white/5"}`}>
      {/* Hamburger — mobile only */}
      <button
        onClick={onMenuToggle}
        className="lg:hidden p-2 rounded-lg text-slate-400 hover:text-white hover:bg-white/5 transition-colors flex-shrink-0"
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
          {/* Account selector */}
          <div className="relative">
            <button
              onClick={() => setMenuOpen((v) => !v)}
              className="flex items-center gap-2 group"
            >
              <div className="text-right hidden sm:block">
                <p className="text-sm font-bold text-white tracking-wide leading-tight">
                  {selectedAccount?.name ?? "Analytica"}
                </p>
                <div className="flex items-center gap-1.5 justify-end mt-0.5">
                  <CheckCircle className="w-2.5 h-2.5 text-emerald-500" />
                  <p className="text-[9px] font-bold uppercase tracking-widest text-emerald-500">
                    {selectedAccount?.platform ?? "Sin cuenta"}
                  </p>
                </div>
              </div>

              <div className={`w-9 h-9 rounded-full flex items-center justify-center shadow-lg border transition-all duration-300 group-hover:border-amber-500/50 ${theme === "light" ? "bg-slate-200 border-slate-300" : "bg-gradient-to-br from-slate-800 to-slate-950 border-white/10"}`}>
                <User className={`w-4 h-4 ${theme === "light" ? "text-slate-500" : "text-slate-400"}`} />
              </div>

              {accounts.length > 1 && (
                <ChevronDown size={13} className={`text-slate-500 transition-transform ${menuOpen ? "rotate-180" : ""}`} />
              )}
            </button>

            {menuOpen && (
              <>
                <div className="fixed inset-0 z-10" onClick={() => setMenuOpen(false)} />
                <div className="absolute right-0 mt-2 w-52 bg-slate-900 border border-white/8 rounded-xl shadow-2xl shadow-black/60 z-20 overflow-hidden">
                  {/* Account list */}
                  {accounts.length > 1 && (
                    <div className="border-b border-white/5 py-1">
                      {accounts.map((acc) => (
                        <button
                          key={acc.id}
                          onClick={() => handleSelectAccount(acc)}
                          className={`w-full flex items-center gap-3 px-4 py-2.5 text-xs transition-colors ${
                            selectedAccount?.id === acc.id
                              ? "text-amber-400 bg-amber-500/8"
                              : "text-slate-300 hover:bg-white/5 hover:text-white"
                          }`}
                        >
                          <div className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${selectedAccount?.id === acc.id ? "bg-amber-400" : "bg-slate-600"}`} />
                          <span className="font-medium truncate">{acc.name}</span>
                        </button>
                      ))}
                    </div>
                  )}
                  {/* Logout */}
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
