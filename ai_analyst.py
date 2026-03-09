import os
import sqlite3
import time
from dotenv import load_dotenv
from google import genai
from news_connector import NewsManager

load_dotenv()
API_KEY = os.getenv("GEMINI_API_KEY")
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
OUTPUT_FILE = os.path.join(BASE_DIR, "ai_output.txt")
DB_PATH = os.path.join(BASE_DIR, "bot_analytics.db")

def get_db_data():
    try:
        conn = sqlite3.connect(DB_PATH)
        conn.row_factory = sqlite3.Row
        current = conn.execute('SELECT * FROM current_bot_state WHERE id = 1').fetchone()
        conn.close()
        return dict(current) if current else {}
    except:
        return {}

def get_applied_history():
    """Recupera el historial reciente de cambios aplicados para dar memoria a la IA."""
    try:
        conn = sqlite3.connect(DB_PATH)
        conn.row_factory = sqlite3.Row
        rows = conn.execute('''
            SELECT content, updated_at, bot_version 
            FROM ai_suggestions 
            WHERE status = 'aplicada' 
            ORDER BY id DESC LIMIT 3
        ''').fetchall()
        conn.close()
        
        history = ""
        for i, r in enumerate(rows):
            history += f"\n[CAMBIO #{i+1} - {r['updated_at']} (v{r['bot_version']})]\n{r['content']}\n"
        return history if history else "No hay cambios recientes registrados."
    except:
        return "No se pudo recuperar el historial."

def get_mode_history():
    """Recupera el historial reciente de cambios de modo del bot para dar contexto a la IA."""
    try:
        conn = sqlite3.connect(DB_PATH)
        conn.row_factory = sqlite3.Row
        rows = conn.execute('''
            SELECT bot, old_mode, new_mode, is_active, old_is_active, timestamp 
            FROM bot_mode_history 
            ORDER BY id DESC LIMIT 10
        ''').fetchall()
        conn.close()
        if not rows:
            return "No hay cambios de modo registrados aún."
        lines = []
        for r in rows:
            active_change = ""
            if r['is_active'] != r['old_is_active']:
                active_change = f" | Bot {'ACTIVADO' if r['is_active'] else 'PAUSADO'}"
            lines.append(f"[{r['timestamp']}] {r['bot'].upper()}: {r['old_mode']} → {r['new_mode']}{active_change}")
        return "\n".join(lines)
    except:
        return "No se pudo recuperar el historial de modos."

def get_source_context():
    """Lee fragmentos clave del código para que la IA sepa qué reglas están activas."""
    context = ""
    files_to_read = {
        "bot_crypto.py": "Lógica de Trailing Stop y Gestión de Ciclos",
        "broker.py": "Lógica de Mini-Kelly (Sizing Dinámico) y Ejecución",
        "config.json": "Configuración de Riesgo y Modos Activos"
    }
    
    for filename, desc in files_to_read.items():
        path = os.path.join(BASE_DIR, filename)
        if os.path.exists(path):
            try:
                with open(path, "r", encoding="utf-8") as f:
                    content = f.read()
                    # Tomamos extractos o el archivo completo si no es gigante
                    context += f"\n--- ARCHIVO: {filename} ({desc}) ---\n"
                    context += content[-3000:] # Últimos 3000 caracteres suelen tener la lógica principal
            except: pass
    return context

def get_version_history():
    """Lee el registro de versiones estables para dar contexto histórico."""
    path = os.path.join(BASE_DIR, "docs", "versions", "stable.md")
    if os.path.exists(path):
        try:
            with open(path, "r", encoding="utf-8") as f:
                return f.read()
        except: return "No se pudo leer el historial de versiones."
    return "No hay registro de versiones estables aún."

def analyze():
    if not API_KEY:
        msg = "⚠️ **FALTA API KEY DE GEMINI**\nPara activar la Inteligencia Artificial, debes crear una API Key gratuita en Google AI Studio y añadirla como `GEMINI_API_KEY` en el archivo `.env` del servidor."
        with open(OUTPUT_FILE, "w", encoding="utf-8") as f:
            f.write(msg)
        return

    try:
        client = genai.Client(api_key=API_KEY)
        
        data = get_db_data()
        code_context = get_source_context()
        applied_history = get_applied_history()
        mode_history = get_mode_history()
        version_history = get_version_history()
        
        news_manager = NewsManager()
        news_context = news_manager.get_latest_news_context(limit=10)
        
        prompt = f"""
        Eres el analista cuantitativo experto de 'MaikBotTrade' (XAU/XAG y Cripto).
        Tu misión es dar un diagnóstico profundo basado en:
        1. Datos de rendimiento actuales.
        2. Contexto histórico de versiones/actualizaciones anteriores.
        3. Código fuente actual.
        4. CONTEXTO MACROECONÓMICO (Noticias recientes).

        CONTEXTO MACROECONÓMICO:
        {news_context}

        HISTORIAL DE VERSIONES (Contexto de evolución):
        {version_history}
        
        DATOS DE RENDIMIENTO ACTUALES:
        Balance: ${data.get('balance', 0)} | PNL Sesión: ${data.get('pnl_total', 0)}
        Trades: {data.get('total_w', 0)} TP / {data.get('total_l', 0)} SL
        Estrategias: {data.get('strategy', 'N/A')}
        
        HISTORIAL DE MODOS RECIENTE:
        {mode_history}
        
        CONTEXTO TÉCNICO ACTUAL:
        {code_context}
        
        ESTRUCTURA OBLIGATORIA DE TU RESPUESTA:
        Debes usar exactamente estos encabezados en markdown:

        ### 1. Eficiencia de Trading Actual
        (Evalúa el rendimiento actual comparándolo con el hito de la versión más reciente en el historial. ¿Ha mejorado o empeorado?)

        ### 2. Análisis Algorítmico (Dual Bot)
        (Analiza la lógica de Cripto y Metales basándote en el código proporcionado)

        ### 3. Veredicto Macroeconómico
        (Analiza las noticias recientes proporcionadas y cómo afectan o deberían afectar el comportamiento del bot. Da consejos estratégicos si hay eventos de alto impacto).

        ### 4. Sugerencias de Mejora y Bugs
        (Identifica posibles fallos o áreas de optimización inmediata)

        ### 5. Propuesta Técnica / Código
        (Si sugieres cambios de código, usa bloques markdown con lenguaje específico. Ejemplo: ```python o ```json. SE MUY DETALLISTA.)

        CRÍTICO: Al final del análisis, después de la sección 5, incluye el bloque JSON de parámetros para config.json si aplica (dentro de un bloque de código ```json).

        REGLA: No saludes. Usa un tono técnico y profesional. Negrita para datos clave.
        """
        response = client.models.generate_content(
            model='gemini-flash-latest',
            contents=prompt,
        )
        text = response.text.strip() if response.text else "IA no generó respuesta."
        
        with open(OUTPUT_FILE, "w", encoding="utf-8") as f:
            f.write(text)
            
        print("[AI] Análisis de Gemini generado con contexto de código.")
        
    except Exception as e:
        error_msg = str(e)
        print(f"[ERROR AI] {error_msg}")
        
        if "429" in error_msg or "RESOURCE_EXHAUSTED" in error_msg:
            msg = "⚠️ **Límite de Consultas Inteligentes**\nLa capa gratuita de Gemini ha alcanzado su límite temporal de 15 peticiones por minuto (o cuota diaria). \n\nNo te preocupes, el bot sigue operando normalmente. El análisis se actualizará automáticamente en el próximo ciclo de 10 minutos."
        else:
            msg = f"⚠️ **Error Temporal conectando con Gemini AI**.\nDetalle: {error_msg[:150]}...\n\nReintentando en el próximo ciclo de 10 minutos..."
            
        with open(OUTPUT_FILE, "w", encoding="utf-8") as f:
            f.write(msg)

if __name__ == "__main__":
    analyze()
