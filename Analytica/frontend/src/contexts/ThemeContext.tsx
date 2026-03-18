"use client";
import { createContext, useContext, useEffect, useState } from "react";

type Theme = "dark" | "light";

interface ThemeCtxType { theme: Theme; toggle: () => void; }
const ThemeCtx = createContext<ThemeCtxType>({ theme: "light", toggle: () => {} });

function applyTheme(t: Theme) {
  document.documentElement.classList.toggle("light", t === "light");
  localStorage.setItem("analytica_theme", t);
}

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setTheme] = useState<Theme>("light");

  useEffect(() => {
    const saved = (localStorage.getItem("analytica_theme") ?? "light") as Theme;
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
