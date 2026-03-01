import ccxt
import time
import os
import json
from datetime import datetime, timedelta, timezone
from dotenv import load_dotenv

load_dotenv()

# Configuración API Bitget Testnet
exchange = ccxt.bitget({
    'apiKey': os.getenv('BITGET_API_KEY'),
    'secret': os.getenv('BITGET_API_SECRET'),
    'password': os.getenv('BITGET_PASSWORD'),
    'options': {'defaultType': 'swap'},
})
exchange.set_sandbox_mode(True)

def get_session_start_ts():
    LOCAL_OFFSET = timezone(timedelta(hours=-3))
    now_local = datetime.now(LOCAL_OFFSET)
    midnight_local = now_local.replace(hour=0, minute=0, second=0, microsecond=0, tzinfo=None)
    midnight_utc = midnight_local + timedelta(hours=3)
    return int(midnight_utc.timestamp() * 1000)

session_ts = get_session_start_ts()
print(f"Buscando trades desde (UTC): {datetime.fromtimestamp(session_ts/1000, tz=timezone.utc)}")

for symbol in ['BTC/USDT:USDT', 'ETH/USDT:USDT']:
    try:
        trades = exchange.fetch_my_trades(symbol, since=session_ts, limit=100)
        print(f"\n--- {symbol} ({len(trades)} trades hoy) ---")
        for t in trades:
            info = t.get('info', {})
            profit = float(info.get('profit', 0))
            if abs(profit) > 0:
                print(f"[{t['datetime']}] {t['side']} {t['amount']} @ {t['price']} | PROFIT: {profit} USD")
            else:
                print(f"[{t['datetime']}] {t['side']} {t['amount']} @ {t['price']} | (Apertura o Scale In)")
    except Exception as e:
        print(f"Error en {symbol}: {e}")
