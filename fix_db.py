import sqlite3
import os

DB_PATH = "/home/maikol_salas_m/maikBotTrade/bot_analytics.db"

def fix():
    if not os.path.exists(DB_PATH):
        print(f"Error: {DB_PATH} not found")
        return

    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()
    
    # 1. Asegurar que la tabla existe
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS session_metadata (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            date TEXT UNIQUE,
            starting_balance REAL
        )
    """)
    
    # 2. Corregir el balance de hoy (2026-03-01)
    target_date = "2026-03-01"
    target_bal = 350.33
    
    cursor.execute("INSERT OR REPLACE INTO session_metadata (date, starting_balance) VALUES (?, ?)", (target_date, target_bal))
    conn.commit()
    
    # 3. Verificar
    rows = cursor.execute("SELECT * FROM session_metadata").fetchall()
    print("SESSION METADATA:", rows)
    
    state = cursor.execute("SELECT balance, pnl_total FROM current_bot_state WHERE id=1").fetchone()
    print("CURRENT STATE:", state)
    
    conn.close()

if __name__ == "__main__":
    fix()
