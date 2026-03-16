"use client";

import { useState } from "react";
import { ChevronDown } from "lucide-react";

interface Props {
  title: string;
  subtitle?: string;
  defaultOpen?: boolean;
  badge?: string | number;
  children: React.ReactNode;
}

export default function CollapsibleSection({
  title,
  subtitle,
  defaultOpen = true,
  badge,
  children,
}: Props) {
  const [open, setOpen] = useState(defaultOpen);

  return (
    <div className="rounded-2xl border border-slate-800 bg-slate-900/40 overflow-hidden">
      {/* Header */}
      <button
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center justify-between px-6 py-4 hover:bg-white/[0.02] transition-colors group"
      >
        <div className="flex items-center gap-3">
          <div className="w-1 h-4 rounded-full bg-amber-500/60 group-hover:bg-amber-500 transition-colors" />
          <div className="text-left">
            <p className="text-xs font-bold text-slate-200 uppercase tracking-widest">
              {title}
            </p>
            {subtitle && (
              <p className="text-[10px] text-slate-500 mt-0.5">{subtitle}</p>
            )}
          </div>
          {badge !== undefined && (
            <span className="ml-1 px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-400 text-[10px] font-bold border border-amber-500/20">
              {badge}
            </span>
          )}
        </div>
        <ChevronDown
          size={14}
          className={`text-slate-500 transition-transform duration-300 flex-shrink-0 ${
            open ? "rotate-180" : ""
          }`}
        />
      </button>

      {/* Body — CSS grid trick for smooth collapse without JS height calculation */}
      <div
        style={{
          display: "grid",
          gridTemplateRows: open ? "1fr" : "0fr",
          transition: "grid-template-rows 280ms ease",
        }}
      >
        <div style={{ overflow: "hidden" }}>
          <div className="px-6 pb-6 pt-4 border-t border-slate-800/60">
            {children}
          </div>
        </div>
      </div>
    </div>
  );
}
