import ccxt, os, time
from dotenv import load_dotenv
load_dotenv()
e = ccxt.bitget({
    'apiKey': os.getenv('BITGET_API_KEY'), 
    'secret': os.getenv('BITGET_API_SECRET'), 
    'password': os.getenv('BITGET_PASSWORD'), 
    'options': {'defaultType': 'swap'}
})
e.set_sandbox_mode(True)
e.load_markets()
symbol = 'ETHUSDT'
market = e.market(symbol)
amount = 0.5

print("Prueba 1: create_order con hedgeMode = False")
e.options['hedgeMode'] = False
try:
    o = e.create_order(symbol, 'market', 'buy', amount, params={'marginCoin': 'USDT'})
    print("Exito 1:", o['id'])
    e.create_order(symbol, 'market', 'sell', amount, params={'marginCoin': 'USDT'})
except Exception as ex:
    print("Fallo 1:", type(ex).__name__, str(ex))

print("\nPrueba 2: Raw Request (Mix V1)")
try:
    req = {
        'symbol': market['id'],
        'marginCoin': 'USDT',
        'side': 'buy',
        'orderType': 'market',
        'size': str(amount)
    }
    res = e.privateMixPostOrderPlaceOrder(req)
    print("Exito 2:", res)
    req['side'] = 'sell'
    e.privateMixPostOrderPlaceOrder(req)
except Exception as ex:
    print("Fallo 2:", type(ex).__name__, str(ex))

print("\nPrueba 3: Raw Request V2")
try:
    req = {
        'symbol': market['id'],
        'marginCoin': 'USDT',
        'side': 'buy',
        'orderType': 'market',
        'size': str(amount)
    }
    res = e.privateMixV2PostOrderPlaceOrder(req)  # Intento hipotetico de V2
    print("Exito 3:", res)
    req['side'] = 'sell'
    e.privateMixV2PostOrderPlaceOrder(req)
except Exception as ex:
    print("Fallo 3:", type(ex).__name__, str(ex))
