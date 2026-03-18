"use client";
import { Moon, Sun } from "lucide-react";
import { useTheme } from "../contexts/ThemeContext";

export default function ThemeToggle() {
  const { theme, toggle } = useTheme();
  const isLight = theme === "light";
  return (
    <button
      onClick={toggle}
      title={isLight ? "Modo noche" : "Modo día"}
      style={{
        position: "fixed",
        bottom: "24px",
        right: "24px",
        zIndex: 9999,
        width: "40px",
        height: "40px",
        borderRadius: "50%",
        background: isLight ? "#f1f5f9" : "#1e293b",
        border: isLight ? "1px solid #cbd5e1" : "1px solid rgba(255,255,255,0.1)",
        boxShadow: "0 4px 12px rgba(0,0,0,0.2)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        cursor: "pointer",
        transition: "all 0.2s",
      }}
    >
      {isLight
        ? <Moon size={16} color="#64748b" />
        : <Sun  size={16} color="#f59e0b" />}
    </button>
  );
}
