"use client";

import { Zap, TrendingDown, Clock, Trophy, Skull, DollarSign } from "lucide-react";

interface Props {
  profit_factor: number | null;
  max_drawdown_pct: number | null;
  max_drawdown_usd: number | null;
  expected_payoff: number | null;
  avg_duration_human: string | null;
  max_win_streak: number;
  max_loss_streak: number;
  current_streak: number;
  current_streak_type: string | null;
  total_commission: number;
  total_swap: number;
  cost_impact_pct: number | null;
  gross_profit: number;
  gross_loss: number;
  currency?: string;
}

function MiniKpi({
  label,
  value,
  sub,
  color = "default",
  icon: Icon,
}: {
  label: string;
  value: string;
  sub?: string;
  color?: "green" | "red" | "amber" | "default";
  icon: React.ElementType;
}) {
  const colors = {
    green: "text-emerald-400",
    red: "text-red-400",
    amber: "text-amber-400",
    default: "text-white",
  };
  return (
    <div className="bg-slate-900/60 border border-white/5 rounded-xl p-4 flex flex-col gap-2">
      <div className="flex items-center gap-2 text-slate-500">
        <Icon size={12} />
        <span className="text-[10px] uppercase tracking-widest font-bold">{label}</span>
      </div>
      <span className={`text-xl font-bold ${colors[color]}`}>{value}</span>
      {sub && <span className="text-[10px] text-slate-500">{sub}</span>}
    </div>
  );
}

export default function Phase2Metrics({
  profit_factor,
  max_drawdown_pct,
  max_drawdown_usd,
  expected_payoff,
  avg_duration_human,
  max_win_streak,
  max_loss_streak,
  current_streak,
  current_streak_type,
  total_commission,
  total_swap,
  cost_impact_pct,
  gross_profit,
  gross_loss,
  currency = "USD",
}: Props) {
  const pfColor =
    profit_factor == null ? "default"
    : profit_factor >= 1.5 ? "green"
    : profit_factor >= 1.0 ? "amber"
    : "red";

  const ddColor = max_drawdown_pct == null ? "default"
    : max_drawdown_pct <= 10 ? "green"
    : max_drawdown_pct <= 20 ? "amber"
    : "red";

  const epColor = expected_payoff == null ? "default"
    : expected_payoff > 0 ? "green" : "red";

  const streakEmoji = current_streak_type === "WIN" ? "🔥" : current_streak_type === "LOSS" ? "❄️" : "";

  return (
    <div className="space-y-4">
      {/* Row: Risk metrics */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
        <MiniKpi
          label="Profit Factor"
          value={profit_factor != null ? profit_factor.toFixed(2) : "—"}
          sub={profit_factor != null ? (profit_factor >= 1.5 ? "Saludable" : profit_factor >= 1.0 ? "Marginal" : "Perdedor") : undefined}
          color={pfColor}
          icon={Zap}
        />
        <MiniKpi
          label="Max Drawdown"
          value={max_drawdown_pct != null ? `${max_drawdown_pct.toFixed(1)}%` : "—"}
          sub={max_drawdown_usd != null ? `${currency} ${Math.abs(max_drawdown_usd).toFixed(2)}` : undefined}
          color={ddColor}
          icon={TrendingDown}
        />
        <MiniKpi
          label="Expectancia"
          value={expected_payoff != null ? `${expected_payoff >= 0 ? "+" : ""}${expected_payoff.toFixed(2)}` : "—"}
          sub="por trade"
          color={epColor}
          icon={Zap}
        />
        <MiniKpi
          label="Duración Prom."
          value={avg_duration_human ?? "—"}
          sub="tiempo en mercado"
          icon={Clock}
        />
        <MiniKpi
          label="Mejor Racha"
          value={`${max_win_streak} ganados`}
          sub={current_streak_type === "WIN" ? `${streakEmoji} Racha activa: ${current_streak}` : undefined}
          color="green"
          icon={Trophy}
        />
        <MiniKpi
          label="Peor Racha"
          value={`${max_loss_streak} perdidos`}
          sub={current_streak_type === "LOSS" ? `${streakEmoji} Racha activa: ${current_streak}` : undefined}
          color="red"
          icon={Skull}
        />
      </div>

      {/* Cost Impact */}
      <div className="bg-slate-900/60 border border-white/5 rounded-xl p-5">
        <p className="text-[10px] uppercase tracking-[0.2em] text-slate-500 font-bold mb-4 flex items-center gap-2">
          <DollarSign size={11} className="text-amber-500/60" />
          Impacto de Costos
        </p>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div>
            <p className="text-[10px] text-slate-500 uppercase tracking-widest">PnL Bruto</p>
            <p className={`text-lg font-bold ${gross_profit > 0 ? "text-emerald-400" : "text-red-400"}`}>
              {gross_profit >= 0 ? "+" : ""}{currency} {Math.abs(gross_profit).toFixed(2)}
            </p>
          </div>
          <div>
            <p className="text-[10px] text-slate-500 uppercase tracking-widest">Comisiones</p>
            <p className="text-lg font-bold text-red-400">
              {currency} {Math.abs(total_commission).toFixed(2)}
            </p>
          </div>
          <div>
            <p className="text-[10px] text-slate-500 uppercase tracking-widest">Swaps</p>
            <p className="text-lg font-bold text-red-400">
              {currency} {Math.abs(total_swap).toFixed(2)}
            </p>
          </div>
          <div>
            <p className="text-[10px] text-slate-500 uppercase tracking-widest">% del Bruto</p>
            <p className={`text-lg font-bold ${cost_impact_pct != null && cost_impact_pct > 20 ? "text-amber-400" : "text-slate-300"}`}>
              {cost_impact_pct != null ? `${cost_impact_pct.toFixed(1)}%` : "—"}
            </p>
          </div>
        </div>
        {cost_impact_pct != null && cost_impact_pct > 30 && (
          <p className="mt-3 text-[11px] text-amber-400/80 bg-amber-500/5 border border-amber-500/10 rounded-lg px-3 py-2">
            ⚠️ Los costos representan {cost_impact_pct.toFixed(0)}% de tu PnL bruto. Considera brokers con menores comisiones.
          </p>
        )}
      </div>
    </div>
  );
}
