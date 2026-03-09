import sqlite3, json, os

DB_PATH = "/home/maikol_salas_m/maikBotTrade/bot_analytics.db"
CONFIG_PATH = "/home/maikol_salas_m/maikBotTrade/config.json"

db = sqlite3.connect(DB_PATH)
db.row_factory = sqlite3.Row

tables = [r[0] for r in db.execute("SELECT name FROM sqlite_master WHERE type='table'")]
print("=== TABLAS EN BD ===")
print(tables)

print("\n=== HISTORIAL DE MODOS ===")
if 'bot_mode_history' in tables:
    rows = db.execute("SELECT * FROM bot_mode_history ORDER BY id DESC LIMIT 10").fetchall()
    if rows:
        for r in rows:
            print(dict(r))
    else:
        print("Tabla existe pero está VACÍA")
else:
    print("❌ Tabla bot_mode_history NO EXISTE aún")

print("\n=== CONFIG.JSON ACTUAL ===")
if os.path.exists(CONFIG_PATH):
    with open(CONFIG_PATH) as f:
        cfg = json.load(f)
    print(f"  CRYPTO: mode={cfg.get('crypto',{}).get('trading_mode')} | active={cfg.get('crypto',{}).get('is_active')}")
    print(f"  METALS: mode={cfg.get('metals',{}).get('trading_mode')} | active={cfg.get('metals',{}).get('is_active')}")
else:
    print("No encontrado")

db.close()
