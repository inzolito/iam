# 🛡️ IMPORTANTE: ANTES DE MODIFICAR, LEER MAIK_SYSTEM_RULES.md EN LA RAÍZ.
from flask import Flask, render_template, jsonify, request
import sqlite3
import os
import json
import re
from datetime import datetime, timedelta, timezone

# Gestión de Zona Horaria (Local: UTC-3)
LOCAL_OFFSET = timezone(timedelta(hours=-3))

def get_session_start_ts():
    """Calcula el timestamp (ms) de las 00:00:00 locales para el reset de sesión."""
    LOCAL_OFFSET = timezone(timedelta(hours=-3))
    now_local = datetime.now(LOCAL_OFFSET)
    midnight_local = now_local.replace(hour=0, minute=0, second=0, microsecond=0, tzinfo=None)
    # utc = local + 3
    midnight_utc = midnight_local + timedelta(hours=3)
    return int(midnight_utc.timestamp() * 1000)

app = Flask(__name__)
app.config['TEMPLATES_AUTO_RELOAD'] = True

@app.after_request
def add_header(response):
    response.headers['Cache-Control'] = 'no-store, no-cache, must-revalidate, post-check=0, pre-check=0, max-age=0'
    response.headers['Pragma'] = 'no-cache'
    response.headers['Expires'] = '-1'
    return response

SERVER_BASE = "/home/maikol_salas_m/maikBotTrade"
DB_PATH = os.path.join(SERVER_BASE, "bot_analytics.db")
LOG_PATH = os.path.join(SERVER_BASE, "trades_history.txt")
CONFIG_PATH = os.path.join(SERVER_BASE, "config.json")

def get_db_connection():
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    return conn

def deep_update(source, overrides):
    """ Actualiza recursivamente un diccionario """
    for key, value in overrides.items():
        if isinstance(value, dict) and key in source and isinstance(source[key], dict):
            deep_update(source[key], value)
        else:
            source[key] = value
    return source

@app.route('/')
def index():
    return render_template('index.html')

@app.route('/api/status')
def get_status():
    try:
        conn = get_db_connection()
        # Estado Actual (V3 con métricas extendidas)
        current = {}
        try:
            row = conn.execute('SELECT * FROM current_bot_state WHERE id = 1').fetchone()
            if row: current = dict(row)
        except: pass
        
        # Historial para gráfica (últimos 20)
        history = []
        try:
            rows = conn.execute('SELECT win_rate, timestamp FROM performance_logs ORDER BY id DESC LIMIT 20').fetchall()
            history = [dict(h) for h in reversed(rows)]
        except: pass
        
        # Últimos logs de texto (Invertidos para que el más nuevo salga primero)
        logs = []
        if os.path.exists(LOG_PATH):
            try:
                # Obtenemos la fecha de hoy en formato log (2026-03-01)
                today_prefix = datetime.now(LOCAL_OFFSET).strftime("%Y-%m-%d")
                with open(LOG_PATH, "r", encoding="utf-8") as f:
                    raw_lines = f.readlines()
                    # Filtramos solo las líneas que correspondan a hoy y que tengan el separador |
                    useful_lines = [l for l in raw_lines if "|" in l and today_prefix in l]
                    # Si no hay nada para hoy, mostramos los últimos 10 de ayer por contexto, 
                    # pero marcados (opcionalmente) o simplemente los últimos 25 como fallback
                    if not useful_lines:
                        useful_lines = [l for l in raw_lines if "|" in l][-25:]
                    
                    logs = list(reversed(useful_lines))
            except Exception as e:
                print(f"Log error: {e}")
        
        # Análisis de IA
        ai_analysis = "Esperando primer análisis de la IA..."
        ai_file = os.path.join(SERVER_BASE, "ai_output.txt")
        try:
            if os.path.exists(ai_file):
                with open(ai_file, "r", encoding="utf-8") as f:
                    ai_analysis = f.read()
        except: pass

        # Operaciones Activas Duales
        active_positions_crypto = []
        crypto_json = os.path.join(SERVER_BASE, "active_positions_crypto.json")
        if os.path.exists(crypto_json):
            try:
                with open(crypto_json, "r", encoding="utf-8") as f:
                    active_positions_crypto = json.load(f)
            except: pass

        active_positions_metals = []
        metals_json = os.path.join(SERVER_BASE, "active_positions_metals.json")
        if os.path.exists(metals_json):
            try:
                with open(metals_json, "r", encoding="utf-8") as f:
                    active_positions_metals = json.load(f)
            except: pass

        # Snapshots Lógicos Duales
        bot_crypto_snapshot = {}
        crypto_snap = os.path.join(SERVER_BASE, "bot_crypto_snapshot.json")
        if os.path.exists(crypto_snap):
            try:
                with open(crypto_snap, "r", encoding="utf-8") as f:
                    bot_crypto_snapshot = json.load(f)
            except: pass
            
        bot_metals_snapshot = {}
        metals_snap = os.path.join(SERVER_BASE, "bot_metals_snapshot.json")
        if os.path.exists(metals_snap):
            try:
                with open(metals_snap, "r", encoding="utf-8") as f:
                    bot_metals_snapshot = json.load(f)
            except: pass
        
        data = {
            "current": current,
            "history": history,
            "logs": logs,
            "ai_analysis": ai_analysis,
            "active_positions_crypto": active_positions_crypto,
            "active_positions_metals": active_positions_metals,
            "bot_crypto_snapshot": bot_crypto_snapshot,
            "bot_metals_snapshot": bot_metals_snapshot,
            "start_timestamp": get_session_start_ts()
        }
        conn.close()
        return jsonify(data)
    except Exception as e:
        print(f"Error serving status: {e}")
        return jsonify({})

@app.route('/api/run_ai', methods=['POST'])
def run_ai():
    try:
        import subprocess
        import sys
        # Corremos el script de IA en segundo plano
        subprocess.Popen([sys.executable, "ai_analyst.py"])
        return jsonify({"status": "success", "message": "Análisis IA iniciado"})
    except Exception as e:
        return jsonify({"status": "error", "message": str(e)}), 500

@app.route('/api/config', methods=['GET', 'POST'])
def handle_config():
    config_path = "config.json"
    
    # Defaults segmentados (Cripto vs Metales)
    default_config = {
        "crypto": {
            "is_active": True,
            "trading_mode": "algoritmico",
            "anti_bot": False,
            "risk_rules": {
                "min_stop_loss_pct": 2.5,
                "risk_reward_ratio": 3.0,
                "max_leverage": 20,
                "trailing_activation_pct": 1.5
            }
        },
        "metals": {
            "is_active": True,
            "trading_mode": "híbrido",
            "anti_bot": False,
            "risk_rules": {
                "min_stop_loss_pct": 1.5,
                "risk_reward_ratio": 3.0,
                "max_leverage": 50,
                "trailing_activation_pct": 0.8
            }
        }
    }

    if request.method == 'POST':
        try:
            new_config = request.json
            with open(config_path, "w", encoding="utf-8") as f:
                json.dump(new_config, f, indent=4)
            return jsonify({"status": "success", "config": new_config})
        except Exception as e:
            return jsonify({"status": "error", "message": str(e)}), 400

    else: # GET
        try:
            if not os.path.exists(config_path):
                with open(config_path, "w", encoding="utf-8") as f:
                    json.dump(default_config, f, indent=4)
                return jsonify(default_config)
            
            with open(config_path, "r", encoding="utf-8") as f:
                current_config = json.load(f)
            return jsonify(current_config)
        except Exception as e:
            return jsonify(default_config)

BOT_VERSION = "2.1.0" # Versión actual de la lógica de los bots

@app.route('/api/save_suggestion', methods=['POST'])
def save_suggestion():
    try:
        data = request.json
        text = data.get('text', '')
        if not text or "Recopilando" in text:
            return jsonify({"status": "error", "message": "Contenido vacío o inválido"}), 400
            
        timestamp = datetime.now(LOCAL_OFFSET).strftime("%Y-%m-%d %H:%M:%S")
        
        conn = get_db_connection()
        # Migración/Inicialización robusta
        conn.execute('''
            CREATE TABLE IF NOT EXISTS ai_suggestions (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                timestamp TEXT,
                content TEXT,
                status TEXT DEFAULT 'pendiente',
                updated_at TEXT,
                bot_version TEXT
            )
        ''')
        # Verificar si las columnas existen (para migraciones de BD existentes)
        cursor = conn.execute('PRAGMA table_info(ai_suggestions)')
        columns = [column[1] for column in cursor.fetchall()]
        if 'updated_at' not in columns:
            conn.execute('ALTER TABLE ai_suggestions ADD COLUMN updated_at TEXT')
        if 'bot_version' not in columns:
            conn.execute('ALTER TABLE ai_suggestions ADD COLUMN bot_version TEXT')
            
        conn.execute('''
            INSERT INTO ai_suggestions (timestamp, content, bot_version, updated_at) 
            VALUES (?, ?, ?, ?)
        ''', (timestamp, text, BOT_VERSION, timestamp))
        conn.commit()
        conn.close()
            
        return jsonify({"status": "success", "message": f"Sugerencia (v{BOT_VERSION}) guardada correctamente"})
    except Exception as e:
        return jsonify({"status": "error", "message": str(e)}), 500

@app.route('/api/get_suggestions')
def get_suggestions():
    try:
        conn = get_db_connection()
        rows = conn.execute('SELECT * FROM ai_suggestions ORDER BY id DESC').fetchall()
        suggestions = [dict(r) for r in rows]
        conn.close()
        return jsonify(suggestions)
    except Exception as e:
        return jsonify([])

@app.route('/api/delete_suggestion/<int:suggestion_id>', methods=['DELETE'])
def delete_suggestion(suggestion_id):
    try:
        conn = get_db_connection()
        conn.execute('DELETE FROM ai_suggestions WHERE id = ?', (suggestion_id,))
        conn.commit()
        conn.close()
        return jsonify({"status": "success", "message": "Sugerencia eliminada"})
    except Exception as e:
        return jsonify({"status": "error", "message": str(e)}), 500

@app.route('/api/apply_suggestion/<int:suggestion_id>', methods=['POST'])
def apply_suggestion(suggestion_id):
    try:
        updated_at = datetime.now(LOCAL_OFFSET).strftime("%Y-%m-%d %H:%M:%S")
        conn = get_db_connection()
        row = conn.execute('SELECT content FROM ai_suggestions WHERE id = ?', (suggestion_id,)).fetchone()
        
        if not row:
            conn.close()
            return jsonify({"status": "error", "message": "Sugerencia no encontrada"}), 404
            
        content = row['content']
        
        # Intentar extraer JSON del contenido (bloque de código markdown)
        json_payload = {}
        json_match = re.search(r'```json\s*(\{.*?\})\s*```', content, re.DOTALL)
        if json_match:
            try:
                json_payload = json.loads(json_match.group(1))
            except: pass
            
        # Si hay payload, aplicarlo a config.json
        applied_msg = ""
        if json_payload:
            if os.path.exists(CONFIG_PATH):
                with open(CONFIG_PATH, "r", encoding="utf-8") as f:
                    current_config = json.load(f)
                
                new_config = deep_update(current_config, json_payload)
                
                with open(CONFIG_PATH, "w", encoding="utf-8") as f:
                    json.dump(new_config, f, indent=4)
                applied_msg = " Parámetros aplicados al algoritmo con éxito."

        conn.execute('UPDATE ai_suggestions SET status = "aplicada", updated_at = ? WHERE id = ?', (updated_at, suggestion_id))
        conn.commit()
        conn.close()
        
        return jsonify({
            "status": "success", 
            "message": f"Sugerencia marcada como aplicada.{applied_msg}"
        })
    except Exception as e:
        return jsonify({"status": "error", "message": str(e)}), 500

if __name__ == '__main__':
    # Listen on all interfaces so GCP can route
    app.run(host='0.0.0.0', port=5000)
