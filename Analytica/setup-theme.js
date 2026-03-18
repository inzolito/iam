#!/usr/bin/env node
/**
 * setup-theme.js
 * Adds dark/light mode toggle to the Analytica dashboard.
 * Run from C:\www\Analytica: node setup-theme.js
 */

const fs = require("fs");
const path = require("path");

const SRC       = path.join(__dirname, "frontend", "src");
const CONTEXTS  = path.join(SRC, "contexts");
const COMPS     = path.join(SRC, "components");
const APP       = path.join(SRC, "app");

// ── 1. ThemeContext ───────────────────────────────────────────────────────────
fs.writeFileSync(path.join(CONTEXTS, "ThemeContext.tsx"), `"use client";
import { createContext, useContext, useEffect, useState } from "react";

type Theme = "dark" | "light";

interface ThemeCtxType { theme: Theme; toggle: () => void; }
const ThemeCtx = createContext<ThemeCtxType>({ theme: "dark", toggle: () => {} });

function applyTheme(t: Theme) {
  document.documentElement.classList.toggle("light", t === "light");
  localStorage.setItem("analytica_theme", t);
}

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setTheme] = useState<Theme>("dark");

  useEffect(() => {
    const saved = (localStorage.getItem("analytica_theme") ?? "dark") as Theme;
    setTheme(saved);
    applyTheme(saved);
  }, []);

  const toggle = () => {
    const next: Theme = theme === "dark" ? "light" : "dark";
    setTheme(next);
    applyTheme(next);
  };

  return <ThemeCtx.Provider value={{ theme, toggle }}>{children}</ThemeCtx.Provider>;
}

export const useTheme = () => useContext(ThemeCtx);
`);
console.log("✓ ThemeContext.tsx");

// ── 2. ThemeToggle component (fixed bottom-right button) ─────────────────────
fs.writeFileSync(path.join(COMPS, "ThemeToggle.tsx"), `"use client";
import { Moon, Sun } from "lucide-react";
import { useTheme } from "../contexts/ThemeContext";

export default function ThemeToggle() {
  const { theme, toggle } = useTheme();
  return (
    <button
      onClick={toggle}
      title={theme === "dark" ? "Modo día" : "Modo noche"}
      className="fixed bottom-6 right-6 z-50 w-10 h-10 rounded-full
        bg-slate-800 border border-white/10 shadow-xl
        flex items-center justify-center
        hover:bg-slate-700 active:scale-95
        transition-all duration-200
        light:bg-slate-100 light:border-slate-300 light:hover:bg-slate-200"
    >
      {theme === "dark"
        ? <Sun  size={16} className="text-amber-400" />
        : <Moon size={16} className="text-slate-500" />}
    </button>
  );
}
`);
console.log("✓ ThemeToggle.tsx");

// ── 3. layout.tsx ─────────────────────────────────────────────────────────────
fs.writeFileSync(path.join(APP, "layout.tsx"), `import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { ThemeProvider } from "../contexts/ThemeContext";
import ThemeToggle from "../components/ThemeToggle";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Analytica | Terminal",
  description: "Advanced analytics for modern traders.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es" suppressHydrationWarning>
      {/* Anti-flash: apply saved theme before paint */}
      <head>
        <script dangerouslySetInnerHTML={{ __html: \`
          (function(){
            try {
              var t = localStorage.getItem('analytica_theme');
              if (t === 'light') document.documentElement.classList.add('light');
            } catch(e){}
          })();
        \`}} />
      </head>
      <body className={inter.className}>
        <ThemeProvider>
          {children}
          <ThemeToggle />
        </ThemeProvider>
      </body>
    </html>
  );
}
`);
console.log("✓ layout.tsx");

// ── 4. globals.css — append light mode overrides ──────────────────────────────
const GLOBALS = path.join(APP, "globals.css");
const existing = fs.readFileSync(GLOBALS, "utf8");

const LIGHT_CSS = `

/* ═══════════════════════════════════════════════════════
   LIGHT MODE  —  html.light
   ═══════════════════════════════════════════════════════ */

/* Body */
html.light body {
  background: #f1f5f9;
  color: #0f172a;
}

/* Backgrounds */
html.light .bg-slate-950,
html.light [class*="bg-slate-950"] { background-color: #f8fafc !important; }

html.light .bg-slate-900,
html.light [class*="bg-slate-900"] { background-color: #f1f5f9 !important; }

html.light .bg-slate-800,
html.light [class*="bg-slate-800"] { background-color: #e2e8f0 !important; }

html.light .bg-slate-700,
html.light [class*="bg-slate-700"] { background-color: #cbd5e1 !important; }

/* Semi-transparent backgrounds */
html.light [class*="bg-slate-950\\/"],
html.light [class*="bg-slate-900\\/"],
html.light [class*="bg-slate-800\\/"] {
  background-color: rgba(241, 245, 249, 0.7) !important;
}

html.light [class*="bg-white\\/"] {
  background-color: rgba(15, 23, 42, 0.06) !important;
}

/* Text */
html.light .text-white             { color: #0f172a !important; }
html.light .text-slate-100         { color: #1e293b !important; }
html.light .text-slate-200         { color: #334155 !important; }
html.light .text-slate-300         { color: #475569 !important; }
html.light .text-slate-400         { color: #64748b !important; }
html.light .text-slate-500         { color: #94a3b8 !important; }
html.light .text-slate-600         { color: #94a3b8 !important; }
html.light .text-slate-700         { color: #94a3b8 !important; }

/* Borders */
html.light [class*="border-white\\/"]   { border-color: rgba(15,23,42,0.12) !important; }
html.light [class*="border-slate-800"]  { border-color: #cbd5e1 !important; }
html.light [class*="border-slate-700"]  { border-color: #e2e8f0 !important; }

/* Dividers */
html.light [class*="divide-white\\/"] > * + * { border-color: rgba(15,23,42,0.08) !important; }

/* Input fields */
html.light input,
html.light textarea {
  background-color: #f8fafc !important;
  color: #0f172a !important;
  border-color: rgba(15,23,42,0.15) !important;
}

html.light input::placeholder { color: #94a3b8 !important; }

/* Recharts — chart lines/grid */
html.light .recharts-cartesian-grid line { stroke: rgba(15,23,42,0.08) !important; }
html.light .recharts-text { fill: #64748b !important; }

/* ThemeToggle itself stays visible */
html.light .fixed.bottom-6.right-6 {
  background-color: #f1f5f9 !important;
  border-color: #cbd5e1 !important;
}
`;

if (!existing.includes("LIGHT MODE")) {
  fs.writeFileSync(GLOBALS, existing + LIGHT_CSS);
  console.log("✓ globals.css  (light mode styles appended)");
} else {
  console.log("→ globals.css  (light mode already present, skipped)");
}

console.log("\nDone. Build and deploy the frontend to apply changes.");
