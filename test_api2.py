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
print('Probando params holdMode o unidireccional')
try:
    o = e.create_order(symbol, 'market', 'buy', amount, params={'marginCoin': 'USDT', 'holdMode': 'double_hold', 'positionSide': 'long'})
    print('EXITO double_hold:', o['id'])
except Exception as ex:
    print('FALLO double_hold:', ex)

try:
    o = e.create_order(symbol, 'market', 'buy', amount, params={'marginCoin': 'USDT'})
    print('EXITO sin posicion lateral:', o['id'])
except Exception as ex:
    print('FALLO base:', ex)
    
try:
    res = e.privateMixGetMarketOpenPositionMode({'symbol': 'ETHUSDT', 'marginCoin': 'USDT'})
    print('Configuracion actual de Testnet:', res)
except Exception as ex:
    print('Sin acceso a config', ex)
