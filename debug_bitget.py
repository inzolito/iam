import os, ccxt
from dotenv import load_dotenv
load_dotenv()
e = ccxt.bitget({
    'apiKey': os.getenv('BITGET_API_KEY'),
    'secret': os.getenv('BITGET_API_SECRET'),
    'password': os.getenv('BITGET_PASSWORD'),
    'options': {'defaultType': 'swap'}
})
e.set_sandbox_mode(True)
symbol = 'BTC/USDT:USDT'

def test_order(msg, params):
    print(f"\n--- {msg} ---")
    try:
        print(f"Testing BUY {symbol} with params: {params}")
        o = e.create_order(symbol, 'market', 'buy', 0.001, params=params)
        print("SUCCESS:", o['id'])
        # Close
        print(f"Testing SELL {symbol} (ReduceOnly) with params: {params}")
        e.create_order(symbol, 'market', 'sell', 0.001, params={**params, 'reduceOnly': True})
        print("CLOSED SUCCESS")
    except Exception as ex:
        print("ERROR:", ex)

print("Starting diagnostics...")
test_order("1. No extra params", {})
test_order("2. posSide: long", {'posSide': 'long', 'marginCoin': 'USDT'})
test_order("3. positionSide: long", {'positionSide': 'long', 'marginCoin': 'USDT'})
test_order("4. holdSide: long", {'holdSide': 'long', 'marginCoin': 'USDT'})
test_order("5. marginCoin only", {'marginCoin': 'USDT'})
