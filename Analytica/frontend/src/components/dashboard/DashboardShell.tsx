"use client";

import { useState, useEffect } from "react";
import Sidebar from "./Sidebar";
import Navbar from "./Navbar";
import { useTheme } from "../../contexts/ThemeContext";

export default function DashboardShell({ children }: { children: React.ReactNode }) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  useEffect(() => { setMounted(true); }, []);
  const { theme } = useTheme();

  return (
    <div className={`h-screen overflow-hidden selection:bg-amber-500/30 ${theme === "light" ? "bg-slate-100 text-slate-800" : "bg-slate-950 text-slate-200"}`}>
      <Sidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} animated={mounted} />

      {/* Mobile overlay */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/60 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      <div className="lg:pl-64 flex flex-col h-screen">
        <Navbar onMenuToggle={() => setSidebarOpen((v) => !v)} />
        <main className="flex-1 overflow-y-auto pt-16 pb-16 px-4 md:px-8 lg:px-10">
          {children}
        </main>
      </div>
    </div>
  );
}
