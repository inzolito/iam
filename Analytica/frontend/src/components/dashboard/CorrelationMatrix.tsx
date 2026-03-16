"use client";

interface MatrixCell {
  symbol_a: string;
  symbol_b: string;
  correlation: number;
  trades_a: number;
  trades_b: number;
}

interface Props {
  data: { symbols: string[]; matrix: MatrixCell[] };
  currency?: string;
}

function corrColor(v: number): string {
  // Red for negative, green for positive, white for ~0
  const abs = Math.abs(v);
  if (v > 0) return `rgba(52,211,153,${0.15 + abs * 0.55})`;  // emerald
  return `rgba(248,113,113,${0.15 + abs * 0.55})`;             // red
}

function corrLabel(v: number): string {
  if (v > 0.7)  return "Alta positiva";
  if (v > 0.3)  return "Moderada positiva";
  if (v > -0.3) return "Sin correlación";
  if (v > -0.7) return "Moderada negativa";
  return "Alta negativa";
}

export default function CorrelationMatrix({ data }: Props) {
  const { symbols, matrix } = data;

  if (!symbols || symbols.length < 2 || !matrix || matrix.length === 0) {
    return null;
  }

  // Build lookup: {a_b: correlation}
  const lookup: Record<string, number> = {};
  for (const cell of matrix) {
    lookup[`${cell.symbol_a}||${cell.symbol_b}`] = cell.correlation;
    lookup[`${cell.symbol_b}||${cell.symbol_a}`] = cell.correlation;
  }

  const getCorr = (a: string, b: string) => lookup[`${a}||${b}`] ?? null;

  // Top correlated pairs (for the alert section)
  const highCorr = matrix.filter((c) => Math.abs(c.correlation) >= 0.6);

  return (
    <div className="rounded-2xl border border-slate-800 bg-slate-900/60 overflow-hidden">
      {/* Header */}
      <div className="px-6 py-4 border-b border-slate-800">
        <div className="flex items-center gap-3">
          <div className="w-1.5 h-5 rounded-full bg-gradient-to-b from-amber-400 to-amber-600" />
          <div>
            <p className="text-xs font-bold text-white uppercase tracking-widest">
              Correlación de Cartera
            </p>
            <p className="text-[10px] text-slate-500 mt-0.5">
              Correlación de PnL diario entre pares — identifica sobre-exposición
            </p>
          </div>
        </div>
      </div>

      <div className="p-6 space-y-6">
        {/* Matrix grid */}
        <div className="overflow-x-auto">
          <table className="text-[10px] border-collapse w-full min-w-max">
            <thead>
              <tr>
                <th className="w-24 pb-2 pr-2" />
                {symbols.map((s) => (
                  <th
                    key={s}
                    className="pb-2 px-1 text-slate-400 font-bold uppercase tracking-wider text-center"
                    style={{ minWidth: 64 }}
                  >
                    {s.replace("_i", "")}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {symbols.map((rowSym) => (
                <tr key={rowSym}>
                  <td className="pr-3 py-1 text-slate-400 font-bold uppercase tracking-wider text-right whitespace-nowrap">
                    {rowSym.replace("_i", "")}
                  </td>
                  {symbols.map((colSym) => {
                    if (rowSym === colSym) {
                      return (
                        <td
                          key={colSym}
                          className="py-1 px-1 text-center"
                        >
                          <div
                            className="rounded-lg mx-auto flex items-center justify-center font-bold text-slate-300"
                            style={{
                              width: 56, height: 36,
                              background: "rgba(148,163,184,0.12)",
                            }}
                          >
                            1.00
                          </div>
                        </td>
                      );
                    }
                    const corr = getCorr(rowSym, colSym);
                    if (corr === null) {
                      return (
                        <td key={colSym} className="py-1 px-1 text-center">
                          <div
                            className="rounded-lg mx-auto flex items-center justify-center text-slate-600"
                            style={{ width: 56, height: 36, background: "rgba(30,41,59,0.5)" }}
                          >
                            —
                          </div>
                        </td>
                      );
                    }
                    return (
                      <td key={colSym} className="py-1 px-1 text-center">
                        <div
                          className="rounded-lg mx-auto flex items-center justify-center font-bold tabular-nums"
                          style={{
                            width: 56, height: 36,
                            background: corrColor(corr),
                            color: Math.abs(corr) > 0.4 ? "white" : "#94a3b8",
                          }}
                          title={corrLabel(corr)}
                        >
                          {corr.toFixed(2)}
                        </div>
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Legend */}
        <div className="flex items-center gap-4 text-[10px] text-slate-500">
          <div className="flex items-center gap-1.5">
            <div className="w-3 h-3 rounded" style={{ background: "rgba(52,211,153,0.7)" }} />
            <span>Correlación positiva</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="w-3 h-3 rounded" style={{ background: "rgba(248,113,113,0.7)" }} />
            <span>Correlación negativa</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="w-3 h-3 rounded" style={{ background: "rgba(148,163,184,0.12)" }} />
            <span>Sin datos suficientes</span>
          </div>
        </div>

        {/* High correlation alerts */}
        {highCorr.length > 0 && (
          <div className="space-y-2">
            <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">
              Alertas de correlación ≥ 0.6
            </p>
            {highCorr.map((c) => {
              const isHigh = c.correlation > 0;
              return (
                <div
                  key={`${c.symbol_a}-${c.symbol_b}`}
                  className={`flex items-center justify-between px-4 py-2.5 rounded-xl border text-xs ${
                    isHigh
                      ? "border-emerald-500/20 bg-emerald-500/5"
                      : "border-red-500/20 bg-red-500/5"
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-white">
                      {c.symbol_a.replace("_i", "")} ↔ {c.symbol_b.replace("_i", "")}
                    </span>
                    <span className="text-slate-500">
                      ({c.trades_a} + {c.trades_b} trades)
                    </span>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-[10px] text-slate-400">{corrLabel(c.correlation)}</span>
                    <span
                      className={`font-bold tabular-nums ${
                        isHigh ? "text-emerald-400" : "text-red-400"
                      }`}
                    >
                      {c.correlation > 0 ? "+" : ""}
                      {c.correlation.toFixed(3)}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
