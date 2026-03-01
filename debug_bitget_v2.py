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

def try_switch_and_trade(hedge_mode):
    print(f'\n--- Testing with set_position_mode({hedge_mode}) ---')
    try:
        e.set_position_mode(hedge_mode)
        print(f'Successfully set position mode to {hedge_mode}')
    except Exception as ex:
        print(f'Failed to set position mode: {ex}')
    
    # Pruebas con Hedge mode (requiere posSide)
    if hedge_mode:
        print('Trying order with posSide: long')
        try:
            o = e.create_order(symbol, 'market', 'buy', 0.001, params={'posSide': 'long', 'marginCoin': 'USDT'})
            print('SUCCESS Hedge BUY:', o['id'])
        except Exception as ex:
            print('FAILED Hedge BUY:', ex)
    else:
        # Prueba con One-way mode (no debería tener posSide)
        print('Trying order WITHOUT posSide')
        try:
            o = e.create_order(symbol, 'market', 'buy', 0.001, params={'marginCoin': 'USDT'})
            print('SUCCESS One-way BUY:', o['id'])
        except Exception as ex:
            print('FAILED One-way BUY:', ex)

print("Diagnostics V2...")
try_switch_and_trade(False) # One-way
try_switch_and_trade(True)  # Hedge
