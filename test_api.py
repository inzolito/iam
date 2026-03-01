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
symbol = 'ETHUSDT'
amount = 0.5
print('Probando Modo One-Way cambiando marginMode a isolated y marginCoin')
try:
    o = e.create_order(symbol, 'market', 'buy', amount, params={'marginCoin': 'USDT', 'marginMode': 'isolated'})
    print('EXITO en prueba 1', o['id'])
    e.create_order(symbol, 'market', 'sell', amount, params={'marginCoin': 'USDT'})
except Exception as ex:
    print('FALLO 1:', ex)

print('Probando positionSide')
try:
    # Bitget a veces requiere 'long' o 'short' cuando no esta en hedge mode, o 'short'/'long' pero hedge esta bloqueado
    o = e.create_order(symbol, 'market', 'buy', amount, params={'marginCoin': 'USDT', 'positionSide': 'long'})
    print('EXITO en prueba 2', o['id'])
    e.create_order(symbol, 'market', 'sell', amount, params={'marginCoin': 'USDT', 'positionSide': 'short'})
except Exception as ex:
    print('FALLO 2:', ex)

print('Probando cambiar a Hedge Mode manualmente desde API CCXT')
try:
    e.set_position_mode(True, symbol) 
    # True = Hedge mode segun ccxt documentacion de bitget
    o = e.create_order(symbol, 'market', 'buy', amount, params={'marginCoin': 'USDT'})
    print('EXITO en prueba 3 (Hedge)', o['id'])
    e.create_order(symbol, 'market', 'sell', amount, params={'marginCoin': 'USDT'})
except Exception as ex:
    print('FALLO 3:', ex)
