import json
import logging
import os
import uuid
from datetime import date
from typing import Optional

from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, and_, func
from app.models.database import Trade, MacroEvent, TradingAccount
from app.services.stats_service import StatsService
from google import genai

logger = logging.getLogger(__name__)

DAYS = ["Dom", "Lun", "Mar", "Mié", "Jue", "Vie", "Sáb"]


def _heatmap_summary(heatmap: list, top_n=8, bottom_n=5):
    if not heatmap:
        return [], []
    s = sorted(heatmap, key=lambda c: c["avg_pnl"], reverse=True)
    def fmt(c):
        d = c["day"]
        return {
            "day": DAYS[d] if d < len(DAYS) else str(d),
            "hour": f"{c['hour']:02d}:00 UTC",
            "avg_pnl": round(c["avg_pnl"], 2),
            "trades": c["count"],
        }
    return [fmt(x) for x in s[:top_n]], [fmt(x) for x in s[-bottom_n:]]


def _enrich_trades(trades: list) -> dict:
    """
    Compute hidden metrics from raw trade list:
    - win/loss duration asymmetry per symbol
    - BUY vs SELL performance split
    - consecutive loss runs
    - close_reason distribution per symbol
    """
    from collections import defaultdict

    by_symbol: dict = defaultdict(lambda: {
        "wins": [], "losses": [],
        "win_dur": [], "loss_dur": [],
        "buy_pnl": [], "sell_pnl": [],
        "close_reasons": defaultdict(int),
    })

    for t in trades:
        sym = t.get("ticker", "?")
        pnl = t.get("net_profit", 0) or 0
        dur = t.get("duration_hours", 0) or 0
        side = (t.get("side") or "BUY").upper()
        reason = t.get("close_reason") or "unknown"

        d = by_symbol[sym]
        d["close_reasons"][reason] += 1
        if pnl >= 0:
            d["wins"].append(pnl)
            d["win_dur"].append(dur)
        else:
            d["losses"].append(pnl)
            d["loss_dur"].append(dur)
        if side == "BUY":
            d["buy_pnl"].append(pnl)
        else:
            d["sell_pnl"].append(pnl)

    result = {}
    for sym, d in by_symbol.items():
        avg_win_dur  = round(sum(d["win_dur"])  / len(d["win_dur"]),  1) if d["win_dur"]  else None
        avg_loss_dur = round(sum(d["loss_dur"]) / len(d["loss_dur"]), 1) if d["loss_dur"] else None
        avg_buy_pnl  = round(sum(d["buy_pnl"])  / len(d["buy_pnl"]),  2) if d["buy_pnl"]  else None
        avg_sell_pnl = round(sum(d["sell_pnl"]) / len(d["sell_pnl"]), 2) if d["sell_pnl"] else None

        result[sym] = {
            "wins": len(d["wins"]),
            "losses": len(d["losses"]),
            "avg_win_pnl": round(sum(d["wins"]) / len(d["wins"]), 2) if d["wins"] else None,
            "avg_loss_pnl": round(sum(d["losses"]) / len(d["losses"]), 2) if d["losses"] else None,
            "avg_win_duration_h": avg_win_dur,
            "avg_loss_duration_h": avg_loss_dur,
            "duration_bias": (
                "cuts winners early" if avg_win_dur and avg_loss_dur and avg_win_dur < avg_loss_dur
                else "lets losers run" if avg_win_dur and avg_loss_dur and avg_loss_dur > avg_win_dur * 1.5
                else "balanced"
            ),
            "avg_buy_pnl": avg_buy_pnl,
            "avg_sell_pnl": avg_sell_pnl,
            "side_bias": (
                "BUY outperforms" if avg_buy_pnl and avg_sell_pnl and avg_buy_pnl > avg_sell_pnl + 1
                else "SELL outperforms" if avg_sell_pnl and avg_buy_pnl and avg_sell_pnl > avg_buy_pnl + 1
                else "neutral"
            ),
            "close_reasons": dict(d["close_reasons"]),
        }

    # consecutive loss runs
    pnl_sequence = [t.get("net_profit", 0) or 0 for t in trades]
    max_consec_loss = 0
    cur = 0
    loss_clusters = []
    for i, p in enumerate(pnl_sequence):
        if p < 0:
            cur += 1
            max_consec_loss = max(max_consec_loss, cur)
        else:
            if cur >= 3:
                loss_clusters.append(cur)
            cur = 0

    return {
        "by_symbol_deep": result,
        "max_consecutive_losses": max_consec_loss,
        "loss_clusters_of_3plus": loss_clusters,
    }


class AIAnalyticService:
    def __init__(self):
        self.api_key = os.getenv("GEMINI_API_KEY")
        if self.api_key:
            self.client = genai.Client(api_key=self.api_key)
        else:
            self.client = None
            logger.warning("GEMINI_API_KEY not found. AI Analyser disabled.")

    # ── Internal Gemini caller ─────────────────────────────────────────────────
    async def _call_gemini(self, prompt: str) -> dict:
        try:
            response = self.client.models.generate_content(
                model="gemini-2.5-flash",
                contents=prompt,
                config={"response_mime_type": "application/json"},
            )
            return json.loads(response.text)
        except Exception as e:
            logger.error(f"Gemini error: {e}")
            return {"error": f"Gemini error: {str(e)}"}

    # ── Macro events helper ────────────────────────────────────────────────────
    async def _get_macro(self, db, date_from, date_to) -> list:
        filters = []
        if date_from:
            filters.append(func.date(MacroEvent.timestamp) >= date_from)
        if date_to:
            filters.append(func.date(MacroEvent.timestamp) <= date_to)
        q = select(MacroEvent).order_by(MacroEvent.timestamp.asc())
        if filters:
            q = q.where(and_(*filters))
        rows = (await db.execute(q)).scalars().all()
        return [
            {
                "time": e.timestamp.strftime("%Y-%m-%d %H:%M"),
                "event": e.event_name,
                "impact": e.impact,
                "currency": e.currency,
            }
            for e in rows
        ]

    # ═══════════════════════════════════════════════════════════════════════════
    # 1. ANÁLISIS DE SÍMBOLOS
    # ═══════════════════════════════════════════════════════════════════════════
    async def analyze_symbols(
        self, db: AsyncSession, account_id: uuid.UUID,
        date_from: Optional[date], date_to: Optional[date]
    ) -> dict:
        if not self.client:
            return {"error": "AI client not initialized (missing API key)"}

        trades    = await StatsService.get_trades_list(db, account_id, date_from, date_to)
        macro     = await self._get_macro(db, date_from, date_to)
        enriched  = _enrich_trades(trades)

        data = {
            "period": {"from": str(date_from), "to": str(date_to)},
            "total_trades_analyzed": len(trades),
            "deep_metrics_by_symbol": enriched["by_symbol_deep"],
            "max_consecutive_losses": enriched["max_consecutive_losses"],
            "loss_clusters_of_3plus_consecutive": enriched["loss_clusters_of_3plus"],
            "macro_events_high_impact": [m for m in macro if m.get("impact") == "High"],
        }

        prompt = f"""Eres un analista cuantitativo de trading con acceso a métricas de comportamiento de un sistema algorítmico.

DATOS (ya calculados, no los repitas):
{json.dumps(data, indent=2, default=str)}

REGLA CRÍTICA: NO digas "el par X tiene el mejor win rate" ni "evita el par Y" — eso ya está visible en los datos.
Tu trabajo es encontrar PATRONES NO OBVIOS que el trader NO puede ver en las tablas.

ANALIZA ESPECÍFICAMENTE:

1. SESGO DE DURACIÓN (duration_bias): Para cada símbolo con "cuts winners early" o "lets losers run", explica qué significa en términos de gestión emocional/algorítmica. ¿El sistema está siendo sacado del mercado antes de que el trade madure, o está aguantando perdedores con la esperanza de recuperación? Cita los números concretos de avg_win_duration_h vs avg_loss_duration_h.

2. SESGO DIRECCIONAL (side_bias): Si un símbolo muestra "BUY outperforms" o "SELL outperforms", ¿qué implica? ¿La estrategia tiene mejor lógica para detectar tendencias alcistas que bajistas en ese par? ¿O hay un horario donde las ventas funcionan peor? Cita avg_buy_pnl vs avg_sell_pnl.

3. CLUSTERING DE PÉRDIDAS: Si hay rachas de 3+ pérdidas consecutivas, esto es una señal de que el mercado entró en un régimen adverso para la estrategia (alta correlación intra-día, falsos breakouts, etc.). ¿Cuántas rachas hay y qué sugiere sobre la resiliencia del sistema?

4. CORRELACIÓN MACRO ESPECÍFICA: Si hay eventos de alto impacto en el período, ¿coinciden temporalmente con los clusters de pérdidas? Cita el evento y la fecha exacta si hay coincidencia.

5. CIERRE POR RAZÓN: Para los pares con más pérdidas, ¿cuál es el close_reason dominante? Si "sl" domina en un par específico, el problema es la entrada o el SL demasiado estrecho para ESE par. Si "manual" domina en las pérdidas, hay un problema de disciplina o de lógica de salida.

RESPONDE ÚNICAMENTE EN JSON (sin texto fuera del JSON):
{{
    "summary": "2-3 frases con el hallazgo más importante y no obvio del período",
    "trade_failures": "análisis específico con números concretos de duration_bias y close_reason",
    "macro_impact": "correlación específica con eventos o 'Sin eventos de alto impacto coincidentes' si no hay",
    "entry_improvements": "basado en side_bias y duration_bias, qué ajuste concreto haría diferencia",
    "pairs_to_favor": ["TICKER — razón basada en side_bias y duration equilibrado, no solo win rate"],
    "pairs_to_avoid": ["TICKER — razón basada en el patrón específico que encontraste"],
    "suggestions": [
        "sugerencia 1 concreta basada en los datos (menciona números)",
        "sugerencia 2 concreta basada en los datos",
        "sugerencia 3 concreta basada en los datos"
    ]
}}"""

        return await self._call_gemini(prompt)

    # ═══════════════════════════════════════════════════════════════════════════
    # 2. ANÁLISIS DE SESIONES
    # ═══════════════════════════════════════════════════════════════════════════
    async def analyze_sessions(
        self, db: AsyncSession, account_id: uuid.UUID,
        date_from: Optional[date], date_to: Optional[date]
    ) -> dict:
        if not self.client:
            return {"error": "AI client not initialized (missing API key)"}

        sessions_period     = await StatsService.get_by_session(db, account_id, date_from, date_to)
        sessions_historical = await StatsService.get_by_session(db, account_id, None, None)

        # Compute efficiency: PnL per trade vs trade volume
        def enrich_sessions(sessions):
            enriched = []
            for s in sessions:
                trades = s.get("trades", 0)
                total_pnl = s.get("total_pnl", 0)
                avg_pnl = s.get("avg_pnl", 0)
                win_rate = s.get("win_rate", 0)
                enriched.append({
                    **s,
                    "efficiency_comment": (
                        "alta frecuencia baja calidad" if trades > 10 and win_rate < 45
                        else "baja frecuencia alta calidad" if trades <= 5 and win_rate > 55
                        else "sobreoperación detectada" if trades > 15 and avg_pnl < 0
                        else "normal"
                    )
                })
            return enriched

        # Find session degradation between historical and current
        hist_map = {s["session"]: s for s in sessions_historical}
        period_map = {s["session"]: s for s in sessions_period}
        degradation = []
        for sess, h in hist_map.items():
            p = period_map.get(sess)
            if p and h.get("win_rate", 0) > 0:
                delta_wr = round((p.get("win_rate", 0) - h.get("win_rate", 0)), 1)
                delta_pnl = round((p.get("avg_pnl", 0) - h.get("avg_pnl", 0)), 2)
                if abs(delta_wr) > 5 or abs(delta_pnl) > 1:
                    degradation.append({
                        "session": sess,
                        "win_rate_delta": delta_wr,
                        "avg_pnl_delta": delta_pnl,
                        "trend": "mejora" if delta_wr > 0 and delta_pnl > 0 else "degradación" if delta_wr < 0 and delta_pnl < 0 else "mixto"
                    })

        data = {
            "period": {"from": str(date_from), "to": str(date_to)},
            "sessions_current_period": enrich_sessions(sessions_period),
            "sessions_all_time_historical": enrich_sessions(sessions_historical),
            "session_changes_vs_historical": degradation,
        }

        prompt = f"""Eres un analista de performance de trading algorítmico. Tienes acceso a métricas de sesión con comparación histórica ya calculada.

DATOS:
{json.dumps(data, indent=2, default=str)}

REGLA CRÍTICA: NO digas simplemente "la sesión X es la mejor/peor" — eso está en los datos.
Busca CAMBIOS DE RÉGIMEN, SOBREOPERACIÓN, y DEGRADACIÓN SILENCIOSA.

ANALIZA:

1. CAMBIO DE RÉGIMEN: En "session_changes_vs_historical", ¿hay sesiones que históricamente eran rentables pero en el período actual tienen win_rate_delta negativo? Esto indica que el mercado cambió en esa sesión — la estrategia ya no funciona igual en ese horario.

2. TRAMPA DE VOLUMEN: Busca sesiones con "sobreoperación detectada" o "alta frecuencia baja calidad". ¿El sistema opera más en la sesión incorrecta? Más trades con menor avg_pnl es una señal de que el algoritmo está forzando entradas cuando el mercado no está en condiciones favorables.

3. SESIÓN OCULTA: ¿Hay alguna sesión con pocos trades pero win_rate alto? Eso es oro — el sistema funciona bien ahí pero opera poco. ¿Por qué?

4. RECOMENDACIÓN OPERATIVA: Basada en los deltas histórico vs período, ¿cuáles sesiones activar, cuáles desactivar, y cuáles reducir el tamaño de posición?

RESPONDE ÚNICAMENTE EN JSON:
{{
    "summary": "el hallazgo más importante — cambio de régimen o sesión sobreoperada, con números concretos",
    "best_sessions": "sesión con mejor eficiencia (no solo PnL total sino avg_pnl y win_rate combinados)",
    "worst_sessions": "sesión con peor eficiencia, incluyendo si hay sobreoperación",
    "historical_comparison": "qué sesiones degradaron o mejoraron y en qué magnitud (cita los deltas)",
    "recommendation": "horario concreto de activación/desactivación con justificación en los datos"
}}"""

        return await self._call_gemini(prompt)

    # ═══════════════════════════════════════════════════════════════════════════
    # 3. ANÁLISIS DE MAPA DE CALOR
    # ═══════════════════════════════════════════════════════════════════════════
    async def analyze_heatmap(
        self, db: AsyncSession, account_id: uuid.UUID,
        date_from: Optional[date], date_to: Optional[date]
    ) -> dict:
        if not self.client:
            return {"error": "AI client not initialized (missing API key)"}

        heatmap_period     = await StatsService.get_heatmap(db, account_id, date_from, date_to)
        heatmap_historical = await StatsService.get_heatmap(db, account_id, None, None)

        best_p, worst_p = _heatmap_summary(heatmap_period, 10, 6)
        best_h, worst_h = _heatmap_summary(heatmap_historical, 10, 6)

        # Flag statistically weak slots (< 3 trades)
        def flag_significance(slots):
            for s in slots:
                s["reliable"] = s["trades"] >= 4
                s["note"] = "" if s["trades"] >= 4 else f"solo {s['trades']} trades — dato no confiable"
            return slots

        # Find slots that are consistently bad in BOTH period and historical
        best_p_keys  = {(s["day"], s["hour"]) for s in best_p}
        worst_p_keys = {(s["day"], s["hour"]) for s in worst_p}
        worst_h_keys = {(s["day"], s["hour"]) for s in worst_h}
        consistently_bad = [s for s in worst_p if (s["day"], s["hour"]) in worst_h_keys]

        data = {
            "period": {"from": str(date_from), "to": str(date_to)},
            "period_best_slots": flag_significance(best_p),
            "period_worst_slots": flag_significance(worst_p),
            "historical_best_slots": flag_significance(best_h),
            "historical_worst_slots": flag_significance(worst_h),
            "consistently_bad_in_both": consistently_bad,
        }

        prompt = f"""Eres un analista cuantitativo especializado en microestructura de mercado y optimización horaria.

DATOS (avg_pnl = PnL promedio por trade en ese slot día/hora UTC):
{json.dumps(data, indent=2, default=str)}

REGLA CRÍTICA: Los slots con "reliable: false" (< 4 trades) NO son conclusivos — dilo explícitamente si los menciones.
NO listes simplemente los mejores y peores slots — eso está en los datos.

ANALIZA:

1. CONSISTENCIA REAL: De los mejores slots del período, ¿cuántos también aparecen en el histórico? Solo los que aparecen en AMBAS listas son genuinamente buenos. Los que solo aparecen en el período podrían ser ruido estadístico.

2. ZONAS DE DESTRUCCIÓN SISTEMÁTICA: "consistently_bad_in_both" son los slots donde el sistema SIEMPRE pierde, período e histórico. Estos son los más importantes para desactivar. ¿Qué tienen en común en términos de horario de mercado?

3. PATRÓN INTRADIARIO: Mirando los mejores slots, ¿hay una ventana de horas del día donde la estrategia funciona bien independientemente del día? ¿O el rendimiento está muy fragmentado (un slot aquí, otro allá sin coherencia)?

4. APERTURA/CIERRE DE MERCADO: ¿Los peores slots coinciden con los primeros 30-60 minutos de apertura de Londres (08:00-09:00 UTC) o NY (13:00-14:00 UTC)? Esos suelen ser momentos de alta volatilidad desordenada donde las estrategias algorítmicas pierden más.

5. HORARIO OPTIMIZADO: Propón un horario de activación específico basado SOLO en slots con reliable=true que aparecen en histórico Y período. Formato: "Lun-Vie 09:00-12:00 UTC, excluir 13:00-14:00 UTC".

RESPONDE ÚNICAMENTE EN JSON:
{{
    "summary": "hallazgo principal sobre consistencia o zonas de destrucción, con números concretos",
    "golden_hours": "slots confirmados en período E histórico con reliable=true (los únicos en los que confiar)",
    "avoid_hours": "slots de 'consistently_bad_in_both' y por qué son estructuralmente malos",
    "weekly_pattern": "¿hay días de la semana donde los buenos slots se concentran? ¿o días donde todo va mal?",
    "schedule_recommendation": "horario concreto basado solo en slots estadísticamente confiables"
}}"""

        return await self._call_gemini(prompt)
