"use client";

import { useEffect, useState } from "react";

interface Session {
  name: string;
  openH: number;
  closeH: number;
  color: string;
  crossesMidnight: boolean;
}

const SESSIONS: Session[] = [
  { name: "Tokyo",     openH: 0,  closeH: 9,  color: "#f59e0b", crossesMidnight: false },
  { name: "Londres",   openH: 8,  closeH: 17, color: "#3b82f6", crossesMidnight: false },
  { name: "Nueva York",openH: 13, closeH: 22, color: "#10b981", crossesMidnight: false },
  { name: "Sydney",    openH: 22, closeH: 7,  color: "#a78bfa", crossesMidnight: true  },
];

function isFxWeekend(now: Date): boolean {
  const day = now.getUTCDay(); // 0=Sun, 5=Fri, 6=Sat
  const h   = now.getUTCHours();
  if (day === 6) return true;
  if (day === 0 && h < 22) return true;
  if (day === 5 && h >= 22) return true;
  return false;
}

function isSessionOpen(s: Session, now: Date): boolean {
  const h = now.getUTCHours();
  if (s.crossesMidnight) return h >= s.openH || h < s.closeH;
  return h >= s.openH && h < s.closeH;
}

function minutesUntil(targetH: number, now: Date): number {
  const nowMins = now.getUTCHours() * 60 + now.getUTCMinutes();
  const tgtMins = targetH * 60;
  const diff    = tgtMins - nowMins;
  return diff > 0 ? diff : diff + 24 * 60;
}

function minutesUntilClose(s: Session, now: Date): number {
  return minutesUntil(s.closeH, now);
}

function minutesUntilOpen(s: Session, now: Date): number {
  return minutesUntil(s.openH, now);
}

function fmtCountdown(mins: number): string {
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return h > 0 ? `${h}h ${String(m).padStart(2, "0")}m` : `${m}m`;
}

export default function MarketSessions() {
  const [now, setNow] = useState<Date>(() => new Date());

  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(id);
  }, []);

  const weekend = isFxWeekend(now);

  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
      {SESSIONS.map((s) => {
        const open = !weekend && isSessionOpen(s, now);
        const mins = weekend
          ? null
          : open
          ? minutesUntilClose(s, now)
          : minutesUntilOpen(s, now);

        return (
          <div
            key={s.name}
            className="bg-slate-900/40 border border-white/5 rounded-xl px-4 py-3 flex flex-col gap-1.5"
          >
            <div className="flex items-center gap-2">
              <span
                className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${open ? "animate-pulse" : "opacity-30"}`}
                style={{ backgroundColor: open ? s.color : "#64748b" }}
              />
              <span className="text-[10px] font-bold uppercase tracking-widest text-slate-400">
                {s.name}
              </span>
            </div>

            {weekend ? (
              <p className="text-[10px] text-slate-600 font-medium">Fin de semana</p>
            ) : (
              <>
                <p
                  className="text-xs font-bold"
                  style={{ color: open ? s.color : "#475569" }}
                >
                  {open ? "Abierta" : "Cerrada"}
                </p>
                <p className="text-[10px] text-slate-500">
                  {open ? "Cierra en" : "Abre en"}{" "}
                  <span className="text-slate-300 font-mono">
                    {mins !== null ? fmtCountdown(mins) : "—"}
                  </span>
                </p>
              </>
            )}
          </div>
        );
      })}
    </div>
  );
}
