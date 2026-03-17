import json
import logging
import os
import uuid
from datetime import date
from typing import Optional

from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, and_, func, cast, Date
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
                model="gemini-2.0-flash-lite",
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
    #    Profundidad de entradas, fallos, correlación macro, pares a favorecer/evitar
    # ═══════════════════════════════════════════════════════════════════════════
    async def analyze_symbols(
        self, db: AsyncSession, account_id: uuid.UUID,
        date_from: Optional[date], date_to: Optional[date]
    ) -> dict:
        if not self.client:
            return {"error": "AI client not initialized (missing API key)"}

        by_symbol = await StatsService.get_by_symbol(db, account_id, date_from, date_to)
        trades    = await StatsService.get_trades_list(db, account_id, date_from, date_to)
        macro     = await self._get_macro(db, date_from, date_to)

        data = {
            "period": {"from": str(date_from), "to": str(date_to)},
            "performance_by_pair": by_symbol,
            "trades": [
                {
                    "ticker": t["ticker"],
                    "side": t["side"],
                    "net_profit": t["net_profit"],
                    "duration_hours": t["duration_hours"],
                    "close_reason": t["close_reason"],
                }
                for t in trades[:100]
            ],
            "macro_events_in_period": macro,
        }

        prompt = f"""Eres un Analista Senior de Trading Algorítmico. Analiza el rendimiento por par e identifica causas de fallo y éxito.

DATOS:
{json.dumps(data, indent=2, default=str)}

INSTRUCCIONES:
1. FALLO EN ENTRADAS: ¿Qué está fallando? Busca patrones en duración, cierre por SL, horarios.
2. CORRELACIÓN MACRO: ¿Hubo noticias de alto impacto cerca de los trades negativos? Cita eventos específicos si los hay.
3. PARES A FAVORECER: Qué pares tienen mejor win rate y PnL acumulado. Razón concreta.
4. PARES A EVITAR: Qué pares están destruyendo rentabilidad y por qué.
5. MEJORA DE ENTRADAS: 3-5 sugerencias concretas y accionables.

RESPONDE ÚNICAMENTE EN JSON:
{{
    "summary": "...",
    "trade_failures": "...",
    "macro_impact": "...",
    "entry_improvements": "...",
    "pairs_to_favor": ["TICKER — razón", "..."],
    "pairs_to_avoid": ["TICKER — razón", "..."],
    "suggestions": ["...", "...", "..."]
}}"""

        return await self._call_gemini(prompt)

    # ═══════════════════════════════════════════════════════════════════════════
    # 2. ANÁLISIS DE SESIONES
    #    Período seleccionado vs histórico completo
    # ═══════════════════════════════════════════════════════════════════════════
    async def analyze_sessions(
        self, db: AsyncSession, account_id: uuid.UUID,
        date_from: Optional[date], date_to: Optional[date]
    ) -> dict:
        if not self.client:
            return {"error": "AI client not initialized (missing API key)"}

        sessions_period     = await StatsService.get_by_session(db, account_id, date_from, date_to)
        sessions_historical = await StatsService.get_by_session(db, account_id, None, None)

        data = {
            "period": {"from": str(date_from), "to": str(date_to)},
            "sessions_current_period": sessions_period,
            "sessions_all_time_historical": sessions_historical,
        }

        prompt = f"""Eres un Analista de Rendimiento de Trading. Analiza qué sesiones de mercado son más y menos rentables.

Las sesiones son: Asia (00-08 UTC), Londres (08-13 UTC), London/NY overlap (13-17 UTC), Nueva York (17-22 UTC).

DATOS:
{json.dumps(data, indent=2, default=str)}

INSTRUCCIONES:
1. MEJORES SESIONES: ¿En qué sesiones gana más el trader en el período? ¿Coincide con el histórico?
2. PEORES SESIONES: ¿Qué sesiones están dañando la cuenta? ¿Es un patrón recurrente o anomalía?
3. COMPARACIÓN HISTÓRICA: Compara el período seleccionado contra el histórico. ¿Hay algo atípico?
4. RECOMENDACIÓN: ¿En qué sesiones activar el bot y en cuáles apagarlo?

RESPONDE ÚNICAMENTE EN JSON:
{{
    "summary": "...",
    "best_sessions": "...",
    "worst_sessions": "...",
    "historical_comparison": "...",
    "recommendation": "..."
}}"""

        return await self._call_gemini(prompt)

    # ═══════════════════════════════════════════════════════════════════════════
    # 3. ANÁLISIS DE MAPA DE CALOR
    #    Horarios más y menos rentables, período vs histórico
    # ═══════════════════════════════════════════════════════════════════════════
    async def analyze_heatmap(
        self, db: AsyncSession, account_id: uuid.UUID,
        date_from: Optional[date], date_to: Optional[date]
    ) -> dict:
        if not self.client:
            return {"error": "AI client not initialized (missing API key)"}

        heatmap_period     = await StatsService.get_heatmap(db, account_id, date_from, date_to)
        heatmap_historical = await StatsService.get_heatmap(db, account_id, None, None)

        best_p, worst_p = _heatmap_summary(heatmap_period, 8, 5)
        best_h, worst_h = _heatmap_summary(heatmap_historical, 8, 5)

        data = {
            "period": {"from": str(date_from), "to": str(date_to)},
            "period_best_hours": best_p,
            "period_worst_hours": worst_p,
            "historical_best_hours": best_h,
            "historical_worst_hours": worst_h,
        }

        prompt = f"""Eres un Especialista en Optimización Horaria de Trading. Analiza el mapa de calor para identificar las mejores y peores horas.

DATOS (día/hora en UTC, avg_pnl = ganancia promedio por trade en ese slot):
{json.dumps(data, indent=2, default=str)}

INSTRUCCIONES:
1. HORAS DORADAS: Las mejores combinaciones día/hora. ¿Son consistentes en período e histórico?
2. HORAS A EVITAR: Las peores horas donde el bot pierde de forma consistente.
3. PATRÓN SEMANAL: ¿Hay días de la semana significativamente mejores o peores?
4. HORARIO RECOMENDADO: Un horario concreto de activación del bot (ej: "Lun-Jue 09:00-12:00 UTC y 14:00-17:00 UTC").

RESPONDE ÚNICAMENTE EN JSON:
{{
    "summary": "...",
    "golden_hours": "...",
    "avoid_hours": "...",
    "weekly_pattern": "...",
    "schedule_recommendation": "..."
}}"""

        return await self._call_gemini(prompt)
