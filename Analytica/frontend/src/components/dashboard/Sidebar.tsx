"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { LayoutDashboard, Wallet, BarChart3, Settings, LogOut } from "lucide-react";

const menuItems = [
  { name: "Dashboard", icon: LayoutDashboard, href: "/dashboard" },
  { name: "Cuentas MT5", icon: Wallet, href: "/dashboard/accounts" },
  { name: "Estadísticas", icon: BarChart3, href: "/dashboard/stats" },
  { name: "Configuración", icon: Settings, href: "/dashboard/settings" },
];

export default function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className="fixed left-0 top-0 h-screen w-64 bg-slate-950 border-r border-white/5 flex flex-col z-50">
      <div className="p-8">
        <h1 className="text-xl font-bold tracking-[0.1em] text-white">
          ANALYTICA
        </h1>
        <p className="text-[10px] text-slate-500 tracking-[0.2em] font-medium uppercase mt-1">
          E pur si muove
        </p>
      </div>

      <nav className="flex-1 px-4 py-4 space-y-1">
        {menuItems.map((item) => {
          const isActive = pathname === item.href;
          return (
            <Link
              key={item.name}
              href={item.href}
              className={`flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium transition-all duration-300 group ${
                isActive
                  ? "bg-amber-500/5 text-amber-500"
                  : "text-slate-400 hover:bg-white/5 hover:text-slate-200"
              }`}
            >
              <item.icon className={`w-5 h-5 transition-colors duration-300 ${isActive ? "text-amber-500" : "text-slate-500 group-hover:text-slate-300"}`} />
              {item.name}
            </Link>
          );
        })}
      </nav>

      <div className="p-6 border-t border-white/5">
        <button className="flex items-center gap-3 px-4 py-3 w-full rounded-lg text-sm font-medium text-slate-500 hover:bg-red-500/10 hover:text-red-400 transition-all duration-300 group">
          <LogOut className="w-5 h-5 transition-colors duration-300" />
          <span>Cerrar Sesión</span>
        </button>
      </div>
    </aside>
  );
}
