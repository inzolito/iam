import sqlite3
import os
from datetime import datetime, timedelta, timezone

SERVER_BASE = "/home/maikol_salas_m/maikBotTrade"
DB_PATH = os.path.join(SERVER_BASE, "bot_analytics.db")
LOCAL_OFFSET = timezone(timedelta(hours=-3))

content = """
El **apalancamiento de 50x en metales** es excesivo para el drawdown actual (12.8% del balance perdido). Con un SL del 1.5%, un solo movimiento en contra representa una pérdida del 75% del margen de la posición, lo que hace imposible que la estrategia se recupere con el Win Rate actual. La lógica de **cooldown de 300s** es demasiado agresiva ("metralleta") para metales, permitiendo múltiples entradas en la misma dirección durante una micro-tendencia agotada, lo que explica por qué las derrotas (37) superan a las victorias (28) en un entorno de **PLAN_B**.

```json
{
  "metals": {
    "risk_rules": {
      "min_stop_loss_pct": 0.8,
      "max_leverage": 20,
      "risk_reward_ratio": 2.5
    }
  },
  "crypto": {
    "risk_rules": {
      "min_stop_loss_pct": 0.5,
      "max_leverage": 10
    }
  }
}
```
"""

timestamp = datetime.now(LOCAL_OFFSET).strftime("%Y-%m-%d %H:%M:%S")
conn = sqlite3.connect(DB_PATH)

# Migración de BD
conn.execute('CREATE TABLE IF NOT EXISTS ai_suggestions (id INTEGER PRIMARY KEY AUTOINCREMENT, timestamp TEXT, content TEXT, status TEXT DEFAULT "pendiente", updated_at TEXT, bot_version TEXT)')
cursor = conn.execute('PRAGMA table_info(ai_suggestions)')
columns = [column[1] for column in cursor.fetchall()]
if 'updated_at' not in columns:
    conn.execute('ALTER TABLE ai_suggestions ADD COLUMN updated_at TEXT')
if 'bot_version' not in columns:
    conn.execute('ALTER TABLE ai_suggestions ADD COLUMN bot_version TEXT')

conn.execute('INSERT INTO ai_suggestions (timestamp, content, bot_version, updated_at, status) VALUES (?, ?, ?, ?, ?)', 
             (timestamp, content.strip(), "2.1.0", timestamp, "pendiente"))
conn.commit()
conn.close()
print("Sugerencia de emergencia guardada como pendiente.")
