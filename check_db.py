import sqlite3
import os

DB_PATH = "/home/maikol_salas_m/maikBotTrade/bot_analytics.db"

def check():
    if not os.path.exists(DB_PATH):
        print(f"Error: {DB_PATH} not found")
        return

    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()
    
    # Check sessions
    try:
        rows = cursor.execute("SELECT * FROM session_metadata").fetchall()
        print("SESSIONS:", rows)
    except Exception as e:
        print("SESSIONS ERROR:", e)
    
    # Check state
    try:
        state = cursor.execute("SELECT balance, pnl_total FROM current_bot_state WHERE id=1").fetchone()
        print("STATE:", state)
    except Exception as e:
        print("STATE ERROR:", e)

    # Check suggestions
    try:
        suggestions = cursor.execute("SELECT * FROM ai_suggestions").fetchall()
        print("SUGGESTIONS COUNT:", len(suggestions))
        for s in suggestions[-5:]: # Show last 5
            print(f" - [{s[1]}] {s[2][:50]}... ({s[3]})")
    except Exception as e:
        print("SUGGESTIONS ERROR:", e)
    
    conn.close()

if __name__ == "__main__":
    check()
