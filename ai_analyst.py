import os
import sqlite3
import time
from dotenv import load_dotenv
from google import genai

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

def analyze():
    if not API_KEY:
        msg = "⚠️ **FALTA API KEY DE GEMINI**\nPara activar la Inteligencia Artificial, debes crear una API Key gratuita en Google AI Studio y añadirla como `GEMINI_API_KEY` en el archivo `.env` del servidor.\nEl Análisis con Gemini 1.5 Flash es 100% gratuito (hasta 1500 peticiones al día)."
        with open(OUTPUT_FILE, "w", encoding="utf-8") as f:
            f.write(msg)
        return

    try:
        client = genai.Client(api_key=API_KEY)
        
        data = get_db_data()
        code_context = get_source_context()
        
        prompt = f"""
        Eres el analista cuantitativo experto de mi bot de trading algorítmico (XAU/XAG).
        Tu misión es dar un diagnóstico basado en los números Y el código actual.
        
        DATOS DE RENDIMIENTO:
        Balance: ${data.get('balance', 0)} | PNL Total: ${data.get('pnl_total', 0)}
        Victorias: {data.get('total_w', 0)} | Derrotas: {data.get('total_l', 0)}
        Estrategia Activa: {data.get('strategy', 'N/A')} | Modo: {data.get('bot_mode', 'NORMAL')}
        
        CONTEXTO DEL CÓDIGO ACTUAL (Reglas ya implementadas):
        {code_context}
        
        INSTRUCCIONES CRÍTICAS:
        1. NO sugieras cambios que YA estén implementados en el código de arriba (ej. Kelly o Trailing Asimétrico).
        2. Analiza si los números (W/L) justifican los parámetros actuales del código.
        3. Si el rendimiento es malo pero el código es nuevo, sugiere paciencia o ajustes finos en los umbrales.
        
        Dame un diagnóstico TÉCNICO de MÁXIMO 2-3 PÁRRAFOS MUY BREVES.

        CRÍTICO: Al final de tu respuesta, INCLUYE SIEMPRE un bloque de código JSON con los parámetros que sugieres cambiar/optimizar basándote en tu análisis (solo los campos que quieras modificar de config.json). Si no sugieres cambios, pon un JSON vacío {{}}.
        Ejemplo de formato:
        ```json
        {{
          "crypto": {{ "risk_rules": {{ "min_stop_loss_pct": 0.5 }} }},
          "metals": {{ "risk_rules": {{ "max_leverage": 30 }} }}
        }}
        ```
        
        REGLA DE FORMATO: Usa markdown. Pon en negrita (**texto**) las partes más críticas.
        No saludes. Sé directo y profesional.
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
