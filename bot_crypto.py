import time
import os
import json
from engine import TradeEngine
import broker

def log_trade_local(data):
    """ Guarda el trade en un archivo local .txt (máx 30MB) """
    log_file = "trades_history.txt"
    try:
        if os.path.exists(log_file) and os.path.getsize(log_file) > 31457280:
            with open(log_file, "w") as f: f.write("--- ROTACIÓN POR TAMAÑO ---\n")
            
        with open(log_file, "a") as f:
            f.write(f"{time.strftime('%Y-%m-%d %H:%M:%S')} | {data}\n")
    except Exception as e:
        print(f"[!] Error guardando log local: {e}")

def main():
    print("\n" + "="*50)
    print("      MAIK BOT TRADE - MOTOR v8.2 ULTRA-STABLE")
    print("="*50)
    
    if not broker.check_connection():
        print("[!] Error crítico de conexión. Abortando.")
        return

    # --- CONFIGURACIÓN ESTÁTICA ---
    RISK_LEVEL = 5
    engine = TradeEngine(risk_level=RISK_LEVEL)
    
    print("\n[🧠] SINCRO: Calibrando memoria...")
        
    historial = broker.get_trade_history(limit=50)
    if not historial and os.path.exists("trades_history.txt"):
        try:
            with open("trades_history.txt", "r") as f:
                lines = f.readlines()[-50:]
                # Solo tomamos líneas que sean RESULTADOS reales (no ticks)
                historial = [1 if "ÉXITO" in l else 0 for l in lines if "RESULTADO:" in l]
        except: pass

    if historial:
        engine.seed_history(historial)
        print(f"[OK] Memoria cargada: {len(historial)} trades reales analizados.")

    # --- ESTADO INICIAL ---
    last_balance, last_pos_count = broker.get_account_status()
    active_strat_at_trade = engine.active_strategy
    last_asset = "BTC"
    last_side = "LONG"
    
    # Variables de indicadores
    ratio, z_score, strength, regime, l_high, l_low = 0, 0, 0, 'PLAN_A', 0, 0
    
    print("\n" + "-"*50)
    print(f"{'MODO':<10} | {'BALANCE':<10} | {'Z-SCORE':<8} | {'SEÑAL':<15}")
    print("-"*50)
    
    # Memoria de trailing stop y tiempos de órdenes
    trailing_memory = {}
    last_order_ts = {} # Para evitar el efecto metralleta (cooldown)
    
    # --- PERSISTENCIA DE RECUPERACIÓN ---
    RECOVERY_FILE = "recovery_state.json"
    rec_mem = {"status": "IDLE", "target_symbol": None, "initial_loss": 0, "sol_pnl_acc": 0}
    if os.path.exists(RECOVERY_FILE):
        try:
            with open(RECOVERY_FILE, "r") as f: rec_mem = json.load(f)
        except: pass

    def save_recovery():
        try:
            with open(RECOVERY_FILE, "w") as f: json.dump(rec_mem, f)
        except: pass

    ciclo = 0
    while True:
        try:
            ciclo += 1
            balance, current_pos_count = broker.get_account_status()

            # --- LEER CONFIGURACIÓN (API WEB) ---
            trading_mode = "hibrido"
            anti_bot_mode = False
            is_active = True
            risk_rules = {
                "min_stop_loss_pct": 2.0,
                "risk_reward_ratio": 3.0,
                "max_leverage": 35,
                "trailing_activation_pct": 1.0
            }
            try:
                if os.path.exists("config.json"):
                    with open("config.json", "r") as f:
                        conf = json.load(f)
                        crypto_conf = conf.get("crypto", {})
                        is_active = crypto_conf.get("is_active", True)
                        trading_mode = crypto_conf.get("trading_mode", "hibrido")
                        anti_bot_mode = crypto_conf.get("anti_bot", False)
                        if "risk_rules" in crypto_conf:
                            risk_rules.update(crypto_conf["risk_rules"])
            except: pass

            # --- DETECCIÓN DE RESULTADO (SOLO AL CERRAR) ---
            # Si el número de posiciones bajó, un trade terminó
            if current_pos_count < last_pos_count:
                # Calcular ROE y PnL para el log
                pnl_usd = balance - last_balance
                roe = (pnl_usd / (last_balance if last_balance > 0 else 1)) * 100
                
                log_trade_local(f"RESULTADO: CERRADA | Strat: {active_strat_at_trade} | Asset: {last_asset} | Side: {last_side} | Lev: x{risk_rules.get('max_leverage', 10)} | Fee: $0.15 | Profit: ${pnl_usd:.2f} | ROE: {roe:.2f}% | Bal: ${balance}")
                last_balance = balance # Solo actualizamos balance base tras cierre
            
            # Actualizamos contador de posiciones para el siguiente ciclo
            last_pos_count = current_pos_count

            # --- GESTIÓN DE ESTADO ARSENAL (RESETEO) ---
            if rec_mem["status"] == "ARSENAL" and current_pos_count == 0:
                print("    [🏁] MODO ARSENAL FINALIZADO. Volviendo a IDLE.")
                rec_mem = {"status": "IDLE", "target_symbol": None, "initial_loss": 0, "sol_pnl_acc": 0}
                save_recovery()

            if not is_active:
                print(f"[⏸️] {ciclo} | MOTOR CRIPTO PAUSADO (STANDBY)")
                # Reportar estado pausado a la web
                try:
                    with open("bot_crypto_snapshot.json", "w") as f:
                        json.dump({"strategy": "PAUSADO (STANDBY)", "z_score": 0, "win_rate_a": 0.5, "win_rate_b": 0.5}, f)
                except: pass
                time.sleep(10)
                continue

            # --- OBTENER PRECIOS ---
            asset_1_p, asset_2_p = broker.get_prices(['BTC', 'ETH'])
            if asset_1_p and asset_2_p:
                signal, ratio, z_score, strength, regime, l_high, l_low = engine.process_prices(asset_1_p, asset_2_p, current_pos=current_pos_count)
                
                # Crossover Algorítmico Puro (Ignorar filtros técnicos si el modo es algorítmico)
                if trading_mode == "algoritmico" and signal == 'ESPERAR':
                    if z_score > engine.entry_threshold:
                        signal = "VENTA_BTC_COMPRA_ETH"
                        active_strat_at_trade = "PURO_ZSCORE"
                    elif z_score < -engine.entry_threshold:
                        signal = "COMPRA_BTC_VENTA_ETH"
                        active_strat_at_trade = "PURO_ZSCORE"
                
                # --- CALENTAMIENTO (COOLDOWN) ---
                # Si no hay suficientes datos para el Z-Score, esperamos
                is_warming = len(engine.ratios) < engine.window_size
                
                if not is_warming:
                    # --- LÓGICA ANTI-BOT ---
                    if anti_bot_mode and signal != 'ESPERAR':
                        if 'LONG' in signal or 'COMPRA' in signal or 'BUY' in signal:
                            signal = signal.replace('LONG', 'SHORT').replace('COMPRA', 'VENTA').replace('BUY', 'SELL')
                        elif 'SHORT' in signal or 'VENTA' in signal or 'SELL' in signal:
                            signal = signal.replace('SHORT', 'LONG').replace('VENTA', 'COMPRA').replace('SELL', 'BUY')
                        signal = f"ANTI_{signal}"

                    # Reporte de Terminal
                    icon = "⚡" if anti_bot_mode else ("🤖" if trading_mode == "algoritmico" else ("🧠" if trading_mode == "inteligente" else "🔄"))
                    print(f"{icon} {trading_mode.upper():<11} ({regime}) | ${balance:<9.2f} | {z_score:<8.2f} | {signal:<15}")

                    # Reporte de 'Pensamiento'
                    if ciclo % 6 == 0:
                        snap = engine.get_logic_snapshot(z_score, ratio, l_high, l_low)
                        
                        try:
                            with open("bot_crypto_snapshot.json", "w") as f:
                                json.dump(snap, f)
                        except: pass

                        prefix = "[ANTI] " if anti_bot_mode else ""
                        print(f"\n[🧠 PENSAMIENTO] {prefix}Plan: {snap['strategy']} | Modo: {trading_mode.upper()}")
                        print(f"    ├─ WinRates: A({snap['win_rate_a']:.1%}) vs B({snap['win_rate_b']:.1%})")
                        print(f"    └─ Z-Score: {snap['z_score']:.2f} | Cointegración: {'OK' if snap['cointegration'] else '!!'}")
                        print("-" * 50)

                    # --- GESTIÓN ACTIVA ---
                    open_positions = broker.get_open_positions_details()
                    
                    try:
                        with open("active_positions_crypto.json", "w") as f:
                            json.dump(open_positions, f)
                    except: pass
                    
                    saw_sol_in_loop = False
                    for pos in open_positions:
                        pnl_usd = pos['pnl']
                        contracts = pos['contracts']
                        symbol = pos['symbol']
                        side = pos['side']
                        current_roe = pos.get('pnl_pct', 0)
                        
                        if "SOL" in symbol: saw_sol_in_loop = True

                        # Comisión estimada round-trip
                        notional = contracts * (asset_1_p if 'BTC' in symbol else asset_2_p)
                        est_fees = notional * 0.0012 
                        min_gain = 4.0 # Garantizar $4 neto
                        target_profit = est_fees + min_gain
                        
                        if (ciclo % 3 == 0):
                            print(f"    [🔍] {symbol} {side}: PnL=${pnl_usd:.2f} | Fee=${est_fees:.2f} | Meta=${target_profit:.2f}")

                        if trading_mode == "inteligente":
                            # === SMART TRAILING STOP LOGIC ===
                            if symbol not in trailing_memory: trailing_memory[symbol] = {'max_pnl': 0.0, 'ts_active': False}
                            mem = trailing_memory[symbol]
                            if pnl_usd > mem['max_pnl']: mem['max_pnl'] = pnl_usd
                            
                            trailing_activation_amount = notional * (risk_rules.get("trailing_activation_pct", 1.0) / 100.0)
                            if not mem['ts_active'] and pnl_usd > (est_fees + trailing_activation_amount):
                                mem['ts_active'] = True
                                print(f"    [SMART] 🛡️ TRAILING STOP ACTIVADO para {symbol}")
                                
                            if mem['ts_active']:
                                retracement_threshold = max(est_fees + 1.0, mem['max_pnl'] * 0.75) if side.lower() == 'short' else max(est_fees + 0.5, mem['max_pnl'] * 0.6)
                                if pnl_usd < retracement_threshold:
                                    print(f"    [!] SMART CLOSE ({side.upper()}): Trailing Stop Tocado (${pnl_usd:.2f})")
                                    broker.close_position(symbol, contracts, side)
                                    del trailing_memory[symbol]
                                    
                        else:
                            # 1. Take Profit Proactivo / Stop Loss Algorítmico
                            if pnl_usd > target_profit:
                                zscore_reverted = (side == 'long' and z_score < 0.3) or (side == 'short' and z_score > -0.3)
                                if zscore_reverted or pnl_usd > (target_profit + 8.0):
                                    broker.close_position(symbol, contracts, side)
                                    if symbol in trailing_memory: del trailing_memory[symbol]
                            
                            if (side == 'long' and z_score < -3.8) or (side == 'short' and z_score > 3.8):
                                broker.close_position(symbol, contracts, side)
                                if symbol in trailing_memory: del trailing_memory[symbol]

                        # --- MODO RECOVERY AVANZADO (Lógica por posición) ---
                        trigger_roe = risk_rules.get("offset_trigger_roe", -5.0)
                        is_btc_eth = any(x in symbol for x in ['BTC', 'ETH'])
                        
                        if rec_mem.get("status") == "IDLE" and is_btc_eth and current_roe <= trigger_roe:
                            rec_mem["status"] = "RECOVERING"
                            rec_mem["target_symbol"] = symbol
                            rec_mem["target_side"] = str(side)
                            rec_mem["initial_loss"] = float(pnl_usd)
                            save_recovery()
                            print(f"    [🔥] RECOVERY ACTIVADO: {symbol} en drawdown ({current_roe:.2f}% ROE)")
                            offset_side = "SHORT" if "long" in str(side).lower() else "LONG"
                            broker.execute_trade(f"OFFSET_{offset_side}_SOL", asset_name="SOL", strength=4, risk_rules={**risk_rules, "min_stop_loss_pct": 0.5, "risk_reward_ratio": 40.0})

                        if rec_mem["status"] == "RECOVERING" and "SOL" in symbol:
                            if pnl_usd >= abs(rec_mem["initial_loss"]):
                                print(f"    [✅] RECUPERACIÓN COMPLETADA con SOL profit (${pnl_usd:.2f})")
                                broker.close_position(rec_mem["target_symbol"], 0, "both")
                                winner_trend = side.upper()
                                rec_mem["status"] = "ARSENAL"
                                save_recovery()
                                for asset in ["BTC", "ETH", "SOL", "XRP"]:
                                    broker.execute_trade(f"ARSENAL_{winner_trend}_{asset}", asset_name=asset, strength=5, risk_rules=risk_rules)

                        # --- MODO AGRESIVO ---
                        if risk_rules.get("aggressive_mode", False) and "BTC" in symbol and current_roe >= 10.0:
                            if not any(x in [p['symbol'] for p in open_positions] for x in ["ETH", "SOL"]):
                                for asset in ["ETH", "SOL"]:
                                    broker.execute_trade(f"AGGRESSIVE_{side.upper()}_{asset}", asset_name=asset, strength=3, risk_rules=risk_rules)

                    # --- LÓGICA DE RE-ENTRADA SOL (Fuera del loop de posiciones) ---
                    if rec_mem.get("status") == "RECOVERING" and not saw_sol_in_loop:
                        print(f"    [🔄] SOL RE-ENTRADA: Buscando retroceso para continuar recuperación...")
                        t_side = str(rec_mem.get("target_side", "long")).lower()
                        offset_side = "SHORT" if "long" in t_side else "LONG"
                        broker.execute_trade(f"RE_OFFSET_{offset_side}_SOL", asset_name="SOL", strength=4, risk_rules={**risk_rules, "min_stop_loss_pct": 0.5})

                    # --- EJECUCIÓN CON COOLDOWN (Anti-Metralleta) ---
                    # Solo permitimos una orden del mismo activo cada 5 minutos (300s)
                    # a menos que sea un cierre.
                    target_asset_internal = 'BTC' if ('BTC' in signal) else 'ETH'
                    now_ts = time.time()
                    cooldown_period = 300 # 5 minutos para frenar la metralleta
                    
                    can_trade = True
                    if target_asset_internal in last_order_ts:
                        if now_ts - last_order_ts[target_asset_internal] < cooldown_period:
                            can_trade = False
                            if ciclo % 12 == 0:
                                print(f"    [⏳] COOLDOWN: {target_asset_internal} bloqueado por {int(cooldown_period - (now_ts - last_order_ts[target_asset_internal]))}s")

                    if signal != 'ESPERAR' and current_pos_count < 3 and can_trade:
                        # --- DETECCIÓN CORRECTA DE DIRECCIÓN Y ACTIVO ---
                        # Las señales algorítmicas usan formato VENTA_BTC_COMPRA_ETH / COMPRA_BTC_VENTA_ETH
                        # Las señales híbridas usan LONG POS / SHORT POS
                        # FIX v9.1: Unificar la detección antes de transformar la señal
                        es_long = any(x in signal for x in ['COMPRA', 'LONG', 'BUY'])
                        es_short = any(x in signal for x in ['VENTA', 'SHORT', 'SELL'])
                        
                        # Detectar activo desde la señal original (ANTES de transformar a final_sig)
                        if 'BTC' in signal:
                            last_asset = 'BTC'
                            target_asset_internal = 'BTC'
                        elif 'ETH' in signal:
                            last_asset = 'ETH'
                            target_asset_internal = 'ETH'
                        else:
                            # Señal genérica (LONG POS / SHORT POS) → Target BTC (numrador del ratio)
                            # para evitar sesgo desequilibrado en Shorts.
                            last_asset = 'BTC'
                            target_asset_internal = 'BTC'
                        
                        last_side = "SHORT" if es_short else "LONG"
                        active_strat_at_trade = regime
                        
                        # FIX v9.1 BUG #2: tp_val = None → broker calcula con ATR puro
                        tp_val = None
                        sl_val = None
                        
                        final_sig = signal.replace("ANTI_", "").replace("COMPRA_", "BUY_").replace("VENTA_", "SELL_").replace("COMPRA ", "BUY ").replace("VENTA ", "SELL ")
                        print(f"    └─ [ORDEN] {signal} → {final_sig} | Asset: {target_asset_internal} | Side: {last_side} | SL/TP vía ATR")

                        broker.execute_trade(final_sig, asset_name=target_asset_internal, strength=engine.risk_level, sl_target=sl_val, tp_target=tp_val, risk_rules=risk_rules)
                        
                        last_order_ts[target_asset_internal] = now_ts # Actualizar cooldown
                        nice_signal = signal.replace("ANTI_", "").replace("_", " ")
                        # Log de apertura destacado
                        log_trade_local(f"ORDEN: ABIERTA | Strat: {active_strat_at_trade} | Asset: {last_asset} | Side: {last_side} | Lev: x{risk_rules.get('max_leverage', 10)} | Value: ${balance:.2f}")
                
                else:
                    # Mensaje de Calentamiento
                    if ciclo % 6 == 0:
                        restante = engine.window_size - len(engine.ratios)
                        print(f"[⌛] CALIBRANDO: Faltan {restante} muestras de precio para iniciar...")

        except Exception as e:
            print(f"[!] Ciclo Error: {e}")
            
        time.sleep(10)

if __name__ == "__main__":
    main()
