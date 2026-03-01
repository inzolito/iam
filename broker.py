import os
import ccxt
import sqlite3
import json
import numpy as np
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
    'options': {
        'defaultType': 'swap',  # Para operar contratos de futuros/perpetuos
    }
})
# Activar la testnet de Bitget
exchange.set_sandbox_mode(True)

DB_PATH = os.path.join(os.path.dirname(os.path.abspath(__file__)), "bot_analytics.db")

def get_analytical_data():
    """Recupera el Win Rate y estado actual desde la DB de supervisor."""
    try:
        conn = sqlite3.connect(DB_PATH)
        conn.row_factory = sqlite3.Row
        current = conn.execute('SELECT * FROM current_bot_state WHERE id = 1').fetchone()
        conn.close()
        return dict(current) if current else {}
    except:
        return {}

def check_connection():
    """
    Verifica que las credenciales sean correctas y que haya conexión con Bitget Testnet.
    """
    try:
        print("Intentando conectar con Bitget Testnet...")
        # Forzamos el modo de posición a 'Unilateral' (One-way) para evitar el error 40774
        # Esto asegura que la cuenta y las órdenes coincidan.
        try:
            exchange.set_position_mode(False)
        except Exception as mode_e:
            # Si ya hay posiciones abiertas, no dejará cambiarlo, pero si ya está en One-way no hay problema.
            pass

        balance = exchange.fetch_balance({'type': 'swap'})
        usdt_free = balance.get('USDT', {}).get('free', 0)
        print(f"[OK] Conexión exitosa. Balance disponible en Testnet: {usdt_free} USDT")
        return True
    except ccxt.AuthenticationError:
        print("[ERROR] Error de Autenticación: Verifica tu API Key, API Secret y Password en el archivo .env.")
        return False
    except Exception as e:
        print(f"[ERROR] Error de conexión: {e}")
        return False
def get_account_status():
    """
    Retorna (balance_usdt, numero_posiciones_abiertas)
    """
    try:
        balance = exchange.fetch_balance({'type': 'swap'})
        usdt_total = balance.get('USDT', {}).get('total', 0)
        
        # Contar posiciones reales
        positions = exchange.fetch_positions(params={'productType': 'usdt-futures'})
        pos_count = len([p for p in positions if float(p.get('contracts', 0)) > 0])
        
        return usdt_total, pos_count
    except Exception as e:
        print(f"[ERROR] No se pudo obtener el estado de la cuenta: {e}")
        return 0.0, 0

def get_open_positions_details():
    """
    Retorna una lista de diccionarios con detalles de posiciones abiertas y su PnL no realizado.
    """
    try:
        positions = exchange.fetch_positions(params={'productType': 'usdt-futures'})
        active = []
        for p in positions:
            contracts = float(p.get('contracts', 0))
            if contracts > 0:
                # Calculamos el margen aproximado (Notional / Leverage) para un ROE realista
                try:
                    pnl = float(p.get('unrealizedPnl', 0))
                    notional = abs(float(p.get('notional', 0)))
                    leverage = float(p.get('leverage', 10))
                    if leverage == 0: leverage = 10
                    
                    # El margen es lo que realmente 'puso' el usuario
                    margin_calc = notional / leverage if leverage > 0 else 1
                    pnl_pct = (pnl / margin_calc * 100) if margin_calc > 0 else 0
                except:
                    pnl = 0
                    pnl_pct = 0
                    notional = 0
                    leverage = 10

                active.append({
                    'symbol': p['symbol'],
                    'side': p['side'],
                    'contracts': contracts,
                    'leverage': leverage,
                    'entry_price': float(p.get('entryPrice', 0)),
                    'margin': margin_calc,
                    'notional': notional,
                    'pnl': pnl,
                    'pnl_pct': pnl_pct
                })
        return active
    except Exception as e:
        print(f"[ERROR] Al obtener detalles de posiciones: {e}")
        return []

def close_position(symbol, amount, side):
    """
    Cierra una posición específica al mercado.
    """
    try:
        # Lógica de cierre: Si era 'long', vendemos. Si era 'short', compramos.
        close_side = 'sell' if side == 'long' else 'buy'
        params = {'reduceOnly': True, 'marginCoin': 'USDT'}
        order = exchange.create_order(symbol, 'market', close_side, amount, params=params)
        print(f"[OK] Posición cerrada en {symbol}: {order.get('id')}")
        # Intentar cancelar órdenes pendientes de SL/TP para este símbolo
        try:
            exchange.cancel_all_orders(symbol, params={'planType': 'normal_plan'})
        except: pass
        return True
    except Exception as e:
        print(f"[ERROR] Al cerrar posición: {e}")
        return False

import json

def get_assets_config():
    try:
        with open('assets.json', 'r') as f:
            return json.load(f)
    except:
        return {}

def get_prices(asset_pair_names):
    """
    Obtiene los precios actuales de contratos futuros pasados como tupla/lista (ej. ['BTC', 'ETH'])
    """
    assets = get_assets_config()
    try:
        ticker1 = exchange.fetch_ticker(assets.get(asset_pair_names[0], {}).get('symbol'))
        ticker2 = exchange.fetch_ticker(assets.get(asset_pair_names[1], {}).get('symbol'))
        return ticker1['last'], ticker2['last']
    except Exception as e:
        print(f"[WARNING] Error obteniendo precios del mercado: {e}")
        return None, None

def get_atr(symbol, timeframe='1m', period=14):
    """
    Calcula el Average True Range (ATR) para medir la volatilidad actual.
    """
    try:
        ohlcv = exchange.fetch_ohlcv(symbol, timeframe, limit=period + 1)
        if len(ohlcv) < period:
            return None
        
        # Calcular True Range (TR)
        tr_list = []
        for i in range(1, len(ohlcv)):
            high = ohlcv[i][2]
            low = ohlcv[i][3]
            prev_close = ohlcv[i-1][4]
            tr = max(high - low, abs(high - prev_close), abs(low - prev_close))
            tr_list.append(tr)
            
        return np.mean(tr_list[-period:])
    except Exception as e:
        print(f"[ERROR] No se pudo calcular el ATR: {e}")
        return None

def set_leverage(leverage=10, symbols=[]):
    """
    Configura el apalancamiento para los pares de operación requeridos.
    """
    for symbol in symbols:
        try:
            exchange.set_leverage(leverage, symbol)
            print(f"[OK] Apalancamiento fijado en x{leverage} para {symbol}")
        except Exception as e:
            print(f"[WARNING] No se pudo fijar apalancamiento en {symbol}: {e}")

def execute_trade(signal, asset_name, strength=1, sl_target=None, tp_target=None, risk_rules=None):
    """
    Ejecuta órdenes dinámicas según el asset_name basado en assets.json.
    """
    if risk_rules is None:
        risk_rules = {"min_stop_loss_pct": 2.0, "risk_reward_ratio": 3.0, "max_leverage": 35}

    try:
        assets = get_assets_config()
        if asset_name not in assets:
            print(f"[ERROR] Activo {asset_name} no definido en assets.json")
            return
            
        symbol = assets[asset_name]['symbol']
        amount = assets[asset_name]['trade_size']

        # === DYNAMIC SIZING (MINI-KELLY) ===
        if 'SHORT' not in signal: # Solo aplicamos Mini-Kelly a Longs por ahora (como sugirió Gemini)
            perf = get_analytical_data()
            win_rate = float(perf.get('total_wr_pct', 0))
            
            if win_rate > 75.0:
                print(f"[IA] 🔥 ALTO RENDIMIENTO DETECTADO ({win_rate}% WR). Aplicando Escalado Kelly (+20%)")
                amount *= 1.20
            elif win_rate < 50.0 and win_rate > 0:
                print(f"[IA] ⚠️ BAJO RENDIMIENTO ({win_rate}% WR). Reduciendo riesgo (-30%)")
                amount *= 0.70

        if 'SHORT' in signal:
            side = 'sell'
        else:
            side = 'buy'

        is_scale_in = 'SCALE_IN' in signal
        leverage_map = {1: 10, 2: 20, 3: 30, 4: 35}
        leverage = leverage_map.get(strength, 10)
        
        # Limitar apalancamiento según el Master Config
        max_lev = risk_rules.get("max_leverage", 35)
        if leverage > max_lev: leverage = max_lev
        
        if is_scale_in: leverage = max(10, int(leverage * 0.7))

        set_leverage(leverage, symbols=[symbol])
        exchange.load_markets()
        ticker = exchange.fetch_ticker(symbol)
        current_price = ticker['last']

        # --- LÓGICA DE SALIDA (Ajuste Dinámico por JSON) ---
        atr = get_atr(symbol)
        
        min_sl_pct = risk_rules.get("min_stop_loss_pct", 2.0) / 100.0
        min_sl_dist = current_price * min_sl_pct
        
        # Determinar distancia base del SL sugerida por el motor o el ATR
        if sl_target and tp_target:
            suggested_sl_dist = abs(current_price - sl_target)
            log_type = "NIVELES S/R"
        elif atr:
            mult = 1.0 if is_scale_in else 1.5
            suggested_sl_dist = atr * mult
            log_type = "ATR DINÁMICO"
        else:
            suggested_sl_dist = 0
            log_type = "FIJO"

        # Aplicamos la regla universal: SL es el mayor entre el sugerido y el dinámico configurado
        sl_dist = max(suggested_sl_dist, min_sl_dist)
        
        # Aplicamos riesgo beneficio configurado dinámicamente
        tp_dist = sl_dist * risk_rules.get("risk_reward_ratio", 3.0)

        if side == 'buy':
            sl_price = current_price - sl_dist
            tp_price = current_price + tp_dist
        else: # SHORT
            sl_price = current_price + sl_dist
            tp_price = current_price - tp_dist

        sl_price = float(exchange.price_to_precision(symbol, sl_price))
        tp_price = float(exchange.price_to_precision(symbol, tp_price))

        print(f"[{asset_name}] {log_type} | SL: {sl_price:.2f} | TP: {tp_price:.2f}")
        print(f"[MATRIZ RIESGO] {side.upper()} {asset_name} x{leverage} | Market ~ {current_price}")
        
        order_params = {'marginCoin': 'USDT'}
        order = exchange.create_order(symbol, 'market', side, amount, params=order_params)
        print(f"[OK] Orden {signal} ejecutada: ID {order.get('id')}")
        
        # 5. Condicionales de Cierre (SL/TP)
        try:
             close_side = 'sell' if side == 'buy' else 'buy'
             sl_params = {'triggerPrice': sl_price, 'reduceOnly': True, 'marginCoin': 'USDT'}
             exchange.create_order(symbol, 'market', close_side, amount, params=sl_params)
             
             tp_params = {'triggerPrice': tp_price, 'reduceOnly': True, 'marginCoin': 'USDT'}
             exchange.create_order(symbol, 'market', close_side, amount, params=tp_params)
             print(f"[OK] Órdenes S/R fijadas en sistema.")
             
        except Exception as tp_e:
             print(f"[WARNING] Error fijando SL/TP: {tp_e}")
    except Exception as e:
        print(f"[ERROR] Error ejecutando trade ({signal}): {e}")

def get_trade_history(limit=50):
    """
    Obtiene los últimos resultados de trades del historial para alimentar el motor.
    Retorna una lista de 1 (Gana) o 0 (Pierde).
    """
    try:
        results = []
        # Bitget fetch_closed_orders para swap
        for symbol in ['BTC/USDT:USDT', 'ETH/USDT:USDT']:
            orders = exchange.fetch_closed_orders(symbol, limit=limit)
            for o in orders:
                # Si el profit acumulado de la orden es positivo, es un éxito
                # info suele contener 'cumProfit' o similar en Bitget
                info = o.get('info', {})
                # En Bitget Swap, el PnL realizado suele estar en 'cumProfit' o 'pnl'
                pnl = float(info.get('cumProfit', info.get('pnl', 0)))
                if pnl != 0:
                    results.append(1 if pnl > 0 else 0)
        
        return results[-limit:]
    except Exception as e:
        print(f"[WARNING] No se pudo obtener el historial de trades: {e}")
        return []

# Test de conexión
if __name__ == '__main__':
    check_connection()
