import os
import ccxt
from dotenv import load_dotenv

# Cargar las credenciales desde el archivo .env
load_dotenv()

# Inicializar Bitget en modo Sandbox (Testnet)
# Nota: Para operar en testnet, algunas funciones pueden requerir parámetros adicionales de CCXT
exchange = ccxt.bitget({
    'apiKey': os.getenv('BITGET_API_KEY'),
    'secret': os.getenv('BITGET_API_SECRET'),
    'password': os.getenv('BITGET_PASSWORD'),
    'enableRateLimit': True,
})
# Activar la testnet de Bitget
exchange.set_sandbox_mode(True)

def check_connection():
    """
    Verifica que las credenciales sean correctas y que haya conexión con Bitget Testnet.
    """
    try:
        print("Intentando conectar con Bitget Testnet...")
        # Intentamos obtener el balance para confirmar que la API Key funciona
        balance = exchange.fetch_balance()
        usdt_free = balance.get('USDT', {}).get('free', 0)
        print(f"[OK] Conexión exitosa. Balance disponible en Testnet: {usdt_free} USDT")
        return True
    except ccxt.AuthenticationError:
        print("[ERROR] Error de Autenticación: Verifica tu API Key, API Secret y Password en el archivo .env.")
        return False
    except Exception as e:
        print(f"[ERROR] Error de conexión: {e}")
        return False

def get_prices():
    """
    Obtiene los precios actuales de contratos futuros del Oro (XAU) y Plata (XAG).
    Retorna (precio_oro, precio_plata).
    """
    try:
        # Los símbolos pueden variar en la testnet según lo que el broker ofrezca.
        # Asumiendo los estándar para futuros perpetuos marginados en USDT:
        xau_ticker = exchange.fetch_ticker('XAUUSDT:USDT')
        xag_ticker = exchange.fetch_ticker('XAGUSDT:USDT')
        return xau_ticker['last'], xag_ticker['last']
    except Exception as e:
        # Si da error en Testnet (por falta de liquidez o símbolos inexistentes en sandbox),
        # por ahora imprimirá el error pero retornará None para ser manejado por main
        print(f"[WARNING] Error obteniendo precios del mercado: {e}")
        return None, None

def execute_trade(signal, stop_loss_pct=0.002, take_profit_pct=0.004):
    """
    Ejecuta una orden de mercado con Stop Loss de 0.2% y Take Profit de 0.4%.
    """
    try:
        # Definir configuraciones según el activo a operar
        if signal == 'COMPRA PLATA':
            symbol = 'XAGUSDT:USDT'
            side = 'buy'
            amount = 1     # Cantidad mínima para testnet (Plata)
        elif signal == 'COMPRA ORO':
            symbol = 'XAUUSDT:USDT'
            side = 'buy'
            amount = 0.01  # Cantidad mínima para testnet (Oro)
        else:
            return

        # 1. Obtener precio actual para calcular SL/TP
        ticker = exchange.fetch_ticker(symbol)
        current_price = ticker['last']

        # 2. Calcular los precios de TP y SL
        # Para compra (Long): SL está por debajo, TP está por encima
        sl_price = current_price * (1 - stop_loss_pct)
        tp_price = current_price * (1 + take_profit_pct)

        print(f"[{symbol}] Enviando orden {side.upper()} a Market ~ {current_price} | SL: {sl_price:.4f} | TP: {tp_price:.4f}")

        # 3. Crear orden usando el formato completo soportado por CCXT para Bitget Futuros
        # Ojo: bitget requiere parámetros específicos en create_order para ligar SL y TP,
        # esto asocia la orden principal con órdenes automáticas de cierre.
        params = {
            'stopLossPrice': sl_price,
            'takeProfitPrice': tp_price
        }

        order = exchange.create_order(symbol, 'market', side, amount, params=params)
        print(f"[OK] Orden de {side} ejecutada exitosamente: ID {order.get('id')}")

    except Exception as e:
        print(f"[ERROR] Error ejecutando trade ({signal}): {e}")

# Si se ejecuta este archivo directamente, solo testeará la conexión
if __name__ == '__main__':
    check_connection()
