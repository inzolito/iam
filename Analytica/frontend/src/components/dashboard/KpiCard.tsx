"use client";

import { LucideIcon } from "lucide-react";

interface KpiCardProps {
  label: string;
  value: string | number | null;
  subValue?: string;
  icon?: LucideIcon;
  color?: "default" | "green" | "red" | "amber" | "blue";
  badge?: string;
  badgeColor?: "green" | "red" | "amber" | "orange";
}

const colorMap = {
  default: "text-white",
  green: "text-emerald-400",
  red: "text-red-400",
  amber: "text-amber-400",
  blue: "text-sky-400",
};

const badgeColorMap = {
  green: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20",
  red: "bg-red-500/10 text-red-400 border-red-500/20",
  amber: "bg-amber-500/10 text-amber-400 border-amber-500/20",
  orange: "bg-orange-500/10 text-orange-400 border-orange-500/20",
};

export default function KpiCard({
  label,
  value,
  subValue,
  icon: Icon,
  color = "default",
  badge,
  badgeColor = "amber",
}: KpiCardProps) {
  return (
    <div className="bg-slate-900/60 border border-white/5 rounded-xl p-5 flex flex-col gap-3 hover:border-white/10 transition-all duration-300">
      <div className="flex items-center justify-between">
        <p className="text-[10px] uppercase tracking-[0.2em] text-slate-500 font-bold">
          {label}
        </p>
        {Icon && <Icon className="w-4 h-4 text-slate-600" />}
      </div>

      <div className="flex items-end justify-between gap-2">
        <p className={`text-2xl font-bold tracking-tight ${colorMap[color]}`}>
          {value !== null && value !== undefined ? value : "—"}
        </p>
        {badge && (
          <span
            className={`text-[10px] font-bold uppercase tracking-wider border px-2 py-0.5 rounded-full ${badgeColorMap[badgeColor]}`}
          >
            {badge}
          </span>
        )}
      </div>

      {subValue && (
        <p className="text-[11px] text-slate-500">{subValue}</p>
      )}
    </div>
  );
}
