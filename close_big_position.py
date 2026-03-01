import broker
from dotenv import load_dotenv
import os
load_dotenv()

symbol = 'BTC/USDT:USDT'
contracts = 0.052
side = 'short'

print(f"Intentando cerrar posición de {contracts} en {symbol} ({side})...")
try:
    broker.close_position(symbol, contracts, side)
    print("Cierre exitoso.")
except Exception as e:
    print(f"Error al cerrar: {e}")
