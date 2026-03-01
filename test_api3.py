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
print('Intentando cambiar a modo Unilateral con setMarginMode() desde v2...')
try:
    # Mix endpoint: marginCoin, symbol, posMode
    # posMode: one_way_mode / hedge_mode
    e.privateMixPostAccountSetPositionMode({'symbol': 'ETHUSDT', 'marginCoin': 'USDT', 'posMode': 'one_way_mode'})
    print('EXITO Cambiando Position Mode a One-Way')
except Exception as ex:
    if 'code":"40038' in str(ex):
        print('Exito encubierto: Bitget aviso que ya estamos en One-Way Mode (40038)')
    else:
        print('FALLO Cambio modo:', ex)

try:
    o = e.create_order('ETHUSDT', 'market', 'buy', 0.5, params={'marginCoin': 'USDT', 'positionSide': 'long'})
    print('EXITO prueba compra', o['id'])
    e.create_order('ETHUSDT', 'market', 'sell', 0.5, params={'marginCoin': 'USDT', 'positionSide': 'short'})
except Exception as ex:
    print('FALLO orden experimental:', ex)

try:
    o = e.create_order('ETHUSDT', 'market', 'buy', 0.5, params={'marginCoin': 'USDT'})
    print('EXITO prueba compra simple', o['id'])
    e.create_order('ETHUSDT', 'market', 'sell', 0.5, params={'marginCoin': 'USDT'})
except Exception as ex:
    print('FALLO orden comp simple:', ex)
