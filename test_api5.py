import ccxt, os
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

# Simbolo unficado CCXT (muy importante para Swap/Futuros)
symbol = 'ETH/USDT:USDT'
amount = 0.5

print("Prueba unificada 1: order normal con simbolo completo")
try:
    o = e.create_order(symbol, 'market', 'buy', amount)
    print("EXITO normal:", o['id'])
    e.create_order(symbol, 'market', 'sell', amount, params={'reduceOnly': True})
except Exception as ex:
    print("FALLO normal:", ex)

print("Prueba unificada 2: positionMode false")
e.options['positionMode'] = False
try:
    o = e.create_order(symbol, 'market', 'buy', amount)
    print("EXITO unif 2:", o['id'])
    e.create_order(symbol, 'market', 'sell', amount, params={'reduceOnly': True})
except Exception as ex:
    print("FALLO unif 2:", ex)
