import json
import logging
import os
import uuid
from datetime import date, datetime, timedelta
from typing import Optional

from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, and_, or_, func
from app.models.database import Trade, MacroEvent, AIAnalysisReport, TradingAccount
from app.services.stats_service import StatsService
from google import genai

logger = logging.getLogger(__name__)

class AIAnalyticService:
    def __init__(self):
        self.api_key = os.getenv("GEMINI_API_KEY")
        if self.api_key:
            self.client = genai.Client(api_key=self.api_key)
        else:
            self.client = None
            logger.warning("GEMINI_API_KEY not found. AI Analyser disabled.")

    async def generate_full_audit(
        self, 
        db: AsyncSession, 
        account_id: uuid.UUID, 
        date_from: date, 
        date_to: date,
        system_version: str = "1.0.0"
    ):
        """Generates a comprehensive AI audit using metrics and macro events."""
        if not self.client:
            return {"error": "AI client not initialized (missing API key)"}

        # 1. Fetch data from StatsService
        stats = await StatsService.get_account_stats(db, account_id, date_from, date_to)
        by_symbol = await StatsService.get_by_symbol(db, account_id, date_from, date_to)
        by_session = await StatsService.get_by_session(db, account_id, date_from, date_to)
        heatmap = await StatsService.get_heatmap(db, account_id, date_from, date_to)
        
        # 2. Fetch Macro Events for the period
        macro_filters = []
        if date_from:
            macro_filters.append(func.date(MacroEvent.timestamp) >= date_from)
        if date_to:
            macro_filters.append(func.date(MacroEvent.timestamp) <= date_to)
        macro_q = select(MacroEvent).order_by(MacroEvent.timestamp.asc())
        if macro_filters:
            macro_q = macro_q.where(and_(*macro_filters))
        macro_query = await db.execute(macro_q)
        macro_events = macro_query.scalars().all()

        # 3. Fetch sample of trades to look for correlations (last 50 in period)
        trade_filters = [Trade.account_id == account_id]
        if date_from:
            trade_filters.append(func.date(Trade.close_time) >= date_from)
        if date_to:
            trade_filters.append(func.date(Trade.close_time) <= date_to)
        trades_query = await db.execute(
            select(Trade).where(and_(*trade_filters))
            .order_by(Trade.close_time.desc()).limit(50)
        )
        trades_sample = trades_query.scalars().all()

        # 4. Prepare data density for Prompt
        data_packet = {
            "period": {"from": str(date_from), "to": str(date_to)},
            "global_metrics": {
                "net_pnl": stats["net_profit"],
                "win_rate": f"{stats['win_rate']:.2f}%" if stats['win_rate'] else "N/A",
                "profit_factor": stats["profit_factor"],
                "drawdown_pct": stats["max_drawdown_pct"],
                "sharpe_ratio": stats["sharpe_ratio"],
                "recovery_factor": stats["recovery_factor"]
            },
            "performance_by_pair": by_symbol,
            "performance_by_session": by_session,
            "heatmap_glance": heatmap[:20], # Top 20 density points
            "macro_context": [
                {
                    "time": e.timestamp.strftime("%Y-%m-%d %H:%M"),
                    "event": e.event_name,
                    "impact": e.impact,
                    "currency": e.currency
                } for e in macro_events
            ]
        }

        # 5. Build the Master Prompt
        prompt = f"""
        Actúa como un Auditor Senior de Trading Institucional. Analiza los siguientes datos de rendimiento de un bot de trading:
        
        DATOS DE RENDIMIENTO:
        {json.dumps(data_packet, indent=2)}
        
        OBJETIVO:
        Identificar por qué el sistema no está alcanzando un rendimiento diario del 10% y cómo optimizarlo.
        
        INSTRUCCIONES DE ANÁLISIS:
        1. RESUMEN: Da una visión general del desempeño.
        2. CAUSA RAÍZ (NEGATIVOS): Analiza por qué fallan los trades. Busca correlaciones macro (ej: trades cerca de noticias de alto impacto).
        3. FACTORES DE ÉXITO (POSITIVOS): Qué está funcionando (horarios, pares, baja volatilidad?).
        4. SESIÓN Y HORARIOS: Qué sesiones son tóxicas y cuáles son "Ventanas de Oro".
        5. MAPA DE CALOR: Sugiere horas exactas para apagar o encender el bot.
        6. SUGERENCIAS ACCIONABLES: Dame 3-5 pasos concretos para mejorar el rendimiento.
        
        RESPONDE ÚNICAMENTE EN FORMATO JSON con esta estructura:
        {{
            "summary": "...",
            "negative_trades_root_cause": "...",
            "positive_trades_success_factors": "...",
            "suggestions": ["...", "..."],
            "session_comparison": {{ "insight": "...", "recommendation": "..." }},
            "heatmap_insights": {{ "best_hours": "...", "worst_hours": "..." }}
        }}
        """

        # 6. Call Gemini
        try:
            response = self.client.models.generate_content(
                model="gemini-2.0-flash-lite-preview-02-05",
                contents=prompt,
                config={'response_mime_type': 'application/json'}
            )
            report_data = json.loads(response.text)
            
            # 7. Save Report to DB
            new_report = AIAnalysisReport(
                id=uuid.uuid4(),
                account_id=account_id,
                date_from=date_from,
                date_to=date_to,
                system_version=system_version,
                summary=report_data.get("summary"),
                negative_trades_root_cause=report_data.get("negative_trades_root_cause"),
                positive_trades_success_factors=report_data.get("positive_trades_success_factors"),
                suggestions=report_data.get("suggestions"),
                session_comparison=report_data.get("session_comparison"),
                heatmap_insights=report_data.get("heatmap_insights"),
                metrics_snapshot=data_packet["global_metrics"]
            )
            db.add(new_report)
            await db.commit()
            
            return report_data
            
        except Exception as e:
            logger.error(f"Error generating AI Audit: {e}")
            await db.rollback()
            return {"error": f"Failed to generate AI Audit: {str(e)}"}

