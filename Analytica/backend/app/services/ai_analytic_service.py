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

        prompt = f"""Eres un analista cuantitativo implacable dirigido a un TRADER HUMANO (prohibido usar 'el algoritmo', 'el bot', 'el sistema' o 'tu lógica'). Háblale directo sobre su operativa.

DATOS CRÚDOS CALCULADOS (No repitas tablas, cruza la información):
{json.dumps(data, indent=2, default=str)}

REGLAS ABSOLUTAS (Si las rompes, el análisis falla):
1. CERO RELLENO: Prohibido decir "revisa tu estrategia", "ajusta tus entradas", "evalúa las condiciones". Eso es relleno inútil.
2. EL SL NO ES UN ERROR: Que un trade toque Stop Loss es inherente al trading. NINGÚN trade falla "porque tocó el SL". Si hablas de SL, debes hacerlo usando la DURACIÓN de las pérdidas (duration_bias) para demostrar que aguanta perdedores.
3. SÓLO DATOS DUROS: Cada afirmación debe estar justificada numéricamente. Ejemplo de lo que SÍ hacer: "Tus pérdidas en AUDNZD duran 10.9h mientras que tus ganancias apenas 9.5h, estás cortando los ganadores muy rápido."
4. ACCIONABLES MATEMÁTICOS DIRECTOS: Dile exactamente qué bloquear o alterar basándote en la asimetría BUY/SELL. 

ANALIZA:
1. Asimetría de Duración: Busca la diferencia en horas entre ganancias y pérdidas por par. Demuestra con horas si el trader tiene apego emocional al trade perdedor. 
2. Sesgo Direccional: Compara PnL promedio de BUY vs SELL por par. Si la asimetría es salvaje (ej. pierde consistentemente en SELL y gana en BUY), ordénale que detenga las ventas en ese activo.
3. Rachas de Pérdida vs Macro: Cruza las rachas ("loss_clusters_of_3plus_consecutive") con los "macro_events_high_impact" para ver si fue la volatilidad la causa.

RESPONDE ÚNICAMENTE EN JSON (sin texto adicional):
{{
    "summary": "1 sola frase contundente sobre su mayor ineficiencia matemática o sesgo psicológico detectado en los datos.",
    "trade_failures": "Exposición del sesgo de retención de pérdidas vs ganancias (duration_bias). Menciona horas exactas. Ej: 'En GBPJPY dejas correr pérdidas 15h pero cortas ganancias a las 2h.'",
    "macro_impact": "Verificación de si los clusters de pérdidas (tachas rojas múltiples) coinciden temporalmente con noticias macro de alto impacto. Si no, indica 'Las pérdidas no tienen justificación macro.'",
    "entry_improvements": "Directrices matemáticas del 'side_bias'. Ej: 'Frena por completo las VENTAS en AUDCAD; tu promedio en SELL es profundamente negativo (-$15) frente al BUY (+$17).' (No uses la palabra 'lógica' o 'estrategia').",
    "pairs_to_favor": ["TICKER — Únicamente la razón estadística por eficiencia asimétrica BUY vs SELL y duración equilibrada."],
    "pairs_to_avoid": ["TICKER — Argumento cuantitativo basado en cuántas horas de arrastre tiene en pérdidas o su pésima asimetría direccional."],
    "suggestions": [
        "Plan accionable 1: Métrica dura (ej. 'Recorta tu SL temporal en par X dado que los trades que pasan de Y horas siempre terminan en pérdida').",
        "Plan accionable 2: Enfocada estrictamente en detener las operaciones en contra del 'side_bias'.",
        "Plan accionable 3: Sobre los tiempos de retención ('cuts winners early') usando horas exactas."
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

        prompt = f"""Eres un analista cuantitativo comunicándose con un TRADER HUMANO. Tu objetivo es optimizar sus sesiones de mercado basándote en desviaciones estadísticas de sus operaciones reales. PROHIBIDO usar palabras como 'el algoritmo', 'el bot', 'evalúa tu estrategia'. Háblale directo sobre las decisiones que está tomando.

DATOS:
{json.dumps(data, indent=2, default=str)}

REGLAS ABSOLUTAS:
1. CERO RELLENOS: Nada de sugerencias inútiles como "es recomendable analizar las condiciones del mercado actual". Da órdenes operativas numéricas. 
2. ENFÓCATE EN LA DEGRADACIÓN REAL: Compara activamente el 'session_changes_vs_historical'. Si el trader está operando un horario que históricamente pagaba pero en este periodo cayó en picado, enróstraselo usando los deltas crudos (ej. "Tus trades en Londres se han degradado, tu winrate colapsó un -15%").
3. SOBREOPERACIÓN: Detecta sesiones de alto volumen de trades pero bajo PnL ('alta frecuencia baja calidad'). Dile exactamente que el volumen de tickets cerrados ahí no justifica el esfuerzo.

ANALIZA:
1. Degradación Silenciosa: Indica exactamente qué sesión solía ser rentable históricamente y ahora arruina su rentabilidad diaria (usa los 'session_changes_vs_historical').
2. Trampa de Volumen: Identifica dónde opera casi por ego (muchísimos trades) logrando un 'avg_pnl' miserable.
3. Eficiencia: Encuentra la sesión oro oculto (pocos trades, un 'avg_pnl' y 'win_rate' brutal estadísticamente).

RESPONDE ÚNICAMENTE EN JSON (sin formato Markdown adicional):
{{
    "summary": "1 frase muy directa sobre la mayor ineficiencia detectada en sus sesiones operativas (ej. 'Estás machacando tu cuenta operando compulsivamente en la sesión de NY para un PnL promedio negativo').",
    "best_sessions": "La validación matemática de su mejor sesión comparando PnL contra volumen bajo. Habla con datos crudos, no consejos vagos.",
    "worst_sessions": "Exhibe explícitamente el horario trampa o de sobreoperación, usando sus números avergonzantes.",
    "historical_comparison": "Análisis duro: indica cuántos puntos de % Win Rate perdió o recuperó exactamente respecto a su propia operativa histórica.",
    "recommendation": "Orden cronológica y exacta. (Ej. 'Cancela totalmente la operativa en sesión Londres (degradación total) e incrementa capital en sesión Asia (alta eficiencia / baja exposición)')."
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

        prompt = f"""Eres el analista estadístico personal de un TRADER HUMANO. Tu misión es proteger su capital ordenándole matemáticamente bloquear horas tóxicas y enfocarse en ventajas estadísticas probadas. PROHIBIDO hablar de 'algoritmos', 'sistemas' o 'tu lógica'.

DATOS:
{json.dumps(data, indent=2, default=str)}

REGLAS ABSOLUTAS:
1. NADA DE CONSEJOS VAGOS ("te recomendamos evaluar la apertura"). Debes dar sentencias directas: "Los Martes a las 14:00 UTC tienes un PnL de -$25 consistentemente, corta eso."
2. SOLO USA LOS SLOTS CON 'reliable: true' para asignar fiabilidad. Si algo falló pocas veces di "muestra debilidad, pero no tiene relevancia estadística".
3. FOCOS CRÍTICOS: Lo vital están en los 'consistently_bad_in_both'. Esa es su "zona de sangría recurrente". Es donde el trader consistentemente arruina meses enteros por operar mal.

ANALIZA:
1. Ubica los bloques específicos intradiarios donde pierde dinero todos los meses sistemáticamente (consistently_bad_in_both).
2. Valida los bloques donde gana, filtrando para que aparezca en el 'period' actual y en el 'historical' a la vez. No hables de los slots del periodo actual si resulta que no sirven estadísticamente (reliable: false).
3. Evalúa si rinde mejor en la semana: "Lunes y Miércoles logran X% del PnL".

RESPONDE ÚNICAMENTE EN JSON (sin formato Markdown adicional):
{{
    "summary": "Afirmación severa nombrando el peor agujero micro-horario de la operativa, o la mayor ventana de beneficios. (Apunta directamente al trader)",
    "golden_hours": "Nombra y valida las horas EXACTAS (Ej. 'Los Jueves a las 09:00 UTC promedias +$30 por trade') probadas en ambos historiales. Basado siempre en reliable=true.",
    "avoid_hours": "Indica el bloque horario exacto y el día que aparece en 'consistently_bad_in_both'. Explica con números cuánto le cuesta al trader operar en esas ventanas para que apague los terminales.",
    "weekly_pattern": "Un desglose rápido señalando en qué día colapsa el win rate en la semana y cuándo rinde más basándose puramente en su 'avg_pnl'.",
    "schedule_recommendation": "Bloques concretos que debe permitir y prohibir, especificando UTC y días concretos. Directo, como una receta médica ineludible."
}}"""

        return await self._call_gemini(prompt)
