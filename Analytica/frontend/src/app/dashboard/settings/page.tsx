"use client";

import { useRouter } from "next/navigation";
import { Settings, LogOut, Shield, Bell, Monitor } from "lucide-react";
import { useTheme } from "../../../contexts/ThemeContext";

export default function SettingsPage() {
  const router = useRouter();
  const { theme, toggle } = useTheme();

  const handleLogout = () => {
    localStorage.removeItem("analytica_token");
    router.replace("/login");
  };

  return (
    <div className="space-y-6 pt-2 max-w-2xl">
      <div>
        <h1 className="text-xl font-bold text-white tracking-tight">Configuración</h1>
        <p className="text-xs text-slate-500 mt-0.5">Preferencias de tu cuenta Analytica</p>
      </div>

      {/* Appearance */}
      <div className="bg-slate-900/60 border border-white/5 rounded-xl overflow-hidden">
        <div className="px-5 py-4 border-b border-white/5 flex items-center gap-2">
          <Monitor size={14} className="text-amber-500/70" />
          <p className="text-xs font-bold text-white uppercase tracking-widest">Apariencia</p>
        </div>
        <div className="px-5 py-4 flex items-center justify-between">
          <div>
            <p className="text-sm text-white font-medium">Modo oscuro</p>
            <p className="text-xs text-slate-500 mt-0.5">Interfaz oscura optimizada para traders</p>
          </div>
          <button
            onClick={toggle}
            className={`relative w-11 h-6 rounded-full transition-colors duration-200 ${theme === "dark" ? "bg-amber-500" : "bg-slate-700"}`}
          >
            <span className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform duration-200 ${theme === "dark" ? "translate-x-5" : ""}`} />
          </button>
        </div>
      </div>

      {/* Notifications */}
      <div className="bg-slate-900/60 border border-white/5 rounded-xl overflow-hidden">
        <div className="px-5 py-4 border-b border-white/5 flex items-center gap-2">
          <Bell size={14} className="text-amber-500/70" />
          <p className="text-xs font-bold text-white uppercase tracking-widest">Notificaciones</p>
        </div>
        <div className="px-5 py-4 flex items-center justify-between">
          <div>
            <p className="text-sm text-white font-medium">Alertas de sync</p>
            <p className="text-xs text-slate-500 mt-0.5">Notificar cuando termine una sincronización</p>
          </div>
          <button
            disabled
            className="relative w-11 h-6 rounded-full transition-colors duration-200 bg-slate-700 opacity-40 cursor-not-allowed"
          >
            <span className="absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow" />
          </button>
        </div>
      </div>

      {/* Security */}
      <div className="bg-slate-900/60 border border-white/5 rounded-xl overflow-hidden">
        <div className="px-5 py-4 border-b border-white/5 flex items-center gap-2">
          <Shield size={14} className="text-amber-500/70" />
          <p className="text-xs font-bold text-white uppercase tracking-widest">Seguridad</p>
        </div>
        <div className="px-5 py-4 space-y-3">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-white font-medium">Cifrado AES-256-GCM</p>
              <p className="text-xs text-slate-500 mt-0.5">Contraseñas cifradas en reposo</p>
            </div>
            <span className="text-[10px] text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 rounded-full px-2 py-0.5 font-bold uppercase tracking-widest">
              Activo
            </span>
          </div>
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-white font-medium">JWT Auth</p>
              <p className="text-xs text-slate-500 mt-0.5">Sesión autenticada por token</p>
            </div>
            <span className="text-[10px] text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 rounded-full px-2 py-0.5 font-bold uppercase tracking-widest">
              Activo
            </span>
          </div>
        </div>
      </div>

      {/* Danger zone */}
      <div className="bg-slate-900/60 border border-red-500/10 rounded-xl overflow-hidden">
        <div className="px-5 py-4 border-b border-white/5 flex items-center gap-2">
          <Settings size={14} className="text-red-400/70" />
          <p className="text-xs font-bold text-red-400/80 uppercase tracking-widest">Zona de peligro</p>
        </div>
        <div className="px-5 py-4">
          <button
            onClick={handleLogout}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl border border-red-500/20 bg-red-500/5 text-red-400 text-xs font-bold uppercase tracking-widest hover:bg-red-500/15 transition-all"
          >
            <LogOut size={13} />
            Cerrar sesión
          </button>
        </div>
      </div>
    </div>
  );
}
