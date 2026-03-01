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
    last_asset = "ORO"
    last_side = "LONG"
    
    # Variables de indicadores
    ratio, z_score, strength, regime, l_high, l_low = 0, 0, 0, 'PLAN_A', 0, 0
    
    print("\n" + "-"*50)
    print(f"{'MODO':<10} | {'BALANCE':<10} | {'Z-SCORE':<8} | {'SEÑAL':<15}")
    print("-"*50)
    
    # Memoria de trailing stop (dict para recordar el max profit por símbolo)
    trailing_memory = {}

    ciclo = 0
    while True:
        try:
            ciclo += 1
            balance, current_pos_count = broker.get_account_status()

            # --- DETECCIÓN DE RESULTADO (SOLO AL CERRAR) ---
            # Si el número de posiciones bajó, un trade terminó
            if current_pos_count < last_pos_count:
                result = 1 if balance > last_balance else 0
                res_txt = "ÉXITO" if result == 1 else "FALLO"
                engine.record_outcome(active_strat_at_trade, result)
                log_trade_local(f"RESULTADO: {res_txt} | Strat: {active_strat_at_trade} | Asset: {last_asset} | Side: {last_side} | Bal: ${balance}")
                last_balance = balance # Solo actualizamos balance base tras cierre
            
            # Actualizamos contador de posiciones para el siguiente ciclo
            last_pos_count = current_pos_count

            # --- LEER CONFIGURACIÓN (API WEB) ---
            trading_mode = "inteligente"
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
                        metals_conf = conf.get("metals", {})
                        is_active = metals_conf.get("is_active", True)
                        trading_mode = metals_conf.get("trading_mode", "inteligente")
                        anti_bot_mode = metals_conf.get("anti_bot", False)
                        if "risk_rules" in metals_conf:
                            risk_rules.update(metals_conf["risk_rules"])
            except: pass

            if not is_active:
                print(f"[⏸️] {ciclo} | MOTOR METALES PAUSADO (STANDBY)")
                time.sleep(10)
                continue

            # --- OBTENER PRECIOS ---
            asset_1_p, asset_2_p = broker.get_prices(['ORO', 'PLATA'])
            if asset_1_p and asset_2_p:
                signal, ratio, z_score, strength, regime, l_high, l_low = engine.process_prices(asset_1_p, asset_2_p, current_pos=current_pos_count)
                
                # Crossover Algorítmico Puro (Ignorar filtros técnicos si el modo es algorítmico)
                if trading_mode == "algoritmico" and signal == 'ESPERAR':
                    if z_score > engine.entry_threshold:
                        signal = "VENTA_ORO_COMPRA_PLATA"
                        active_strat_at_trade = "PURO_ZSCORE"
                    elif z_score < -engine.entry_threshold:
                        signal = "COMPRA_ORO_VENTA_PLATA"
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
                    print(f"{icon} {regime:<7} | ${balance:<9.2f} | {z_score:<8.2f} | {signal:<15}")

                    # Reporte de 'Pensamiento'
                    if ciclo % 6 == 0:
                        snap = engine.get_logic_snapshot(z_score, ratio, l_high, l_low)
                        
                        try:
                            with open("bot_metals_snapshot.json", "w") as f:
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
                        with open("active_positions_metals.json", "w") as f:
                            json.dump(open_positions, f)
                    except: pass
                    
                    for pos in open_positions:
                        pnl_usd = pos['pnl']
                        contracts = pos['contracts']
                        symbol = pos['symbol']
                        side = pos['side']
                        
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
                            
                            # Actualizar Max PNL visto
                            if pnl_usd > mem['max_pnl']: mem['max_pnl'] = pnl_usd
                            
                            # Activar Trailing Stop si cruzamos el Break-even + Comisiones + % dinámico
                            trailing_activation_amount = notional * (risk_rules.get("trailing_activation_pct", 1.0) / 100.0)
                            if not mem['ts_active'] and pnl_usd > (est_fees + trailing_activation_amount):
                                mem['ts_active'] = True
                                print(f"    [SMART] 🛡️ TRAILING STOP ACTIVADO (> ${trailing_activation_amount:.2f} PNL) para {symbol}")
                                
                            if mem['ts_active']:
                                # ASYMMETRICAL LOGIC: Shorts protect faster
                                if side.lower() == 'short':
                                    # Para Shorts: Si retrocede un 25% desde la cima o baja de (fees + $1), cerramos.
                                    retracement_threshold = max(est_fees + 1.0, mem['max_pnl'] * 0.75)
                                else:
                                    # Para Longs: Mantenemos el estándar (retroceso del 40%)
                                    retracement_threshold = max(est_fees + 0.5, mem['max_pnl'] * 0.6) 
                                
                                if pnl_usd < retracement_threshold:
                                    print(f"    [!] SMART CLOSE ({side.upper()}): Trailing Stop Tocado (${pnl_usd:.2f}) tras llegar a (${mem['max_pnl']:.2f})")
                                    broker.close_position(symbol, contracts, side)
                                    del trailing_memory[symbol]
                                    
                        else:
                            # === LOGICA HIBRIDA/ALGORITMICA STANDARD (Hard Close) ===
                            if pnl_usd > target_profit:
                                should_close = False
                                if side == 'long' and z_score < 0.2: should_close = True
                                if side == 'short' and z_score > -0.2: should_close = True
                                
                                if pnl_usd > (target_profit + 10.0) or should_close:
                                    print(f"    [!] CIERRE PROACTIVO: Profit Seguro (${pnl_usd:.2f})")
                                    broker.close_position(symbol, contracts, side)
                                    if symbol in trailing_memory: del trailing_memory[symbol]

                    # --- EJECUCIÓN ---
                    if signal != 'ESPERAR' and current_pos_count < 3:
                        # es_long evalúa la señal FINAL (que ya fue invertida si Anti-Bot está activo)
                        es_long = any(x in signal for x in ['COMPRA', 'LONG', 'BUY'])
                        
                        # Targets dinámicos: Si la orden final es LONG, TP va arriba (l_high) y SL abajo (l_low).
                        tp_val = l_high * asset_2_p if es_long else l_low * asset_2_p
                        sl_val = l_low * 0.99 * asset_2_p if es_long else l_high * 1.01 * asset_2_p
                        
                        last_asset = "ORO" if "ORO" in signal else "PLATA"
                        last_side = "SHORT" if "SHORT" in signal else "LONG"
                        active_strat_at_trade = regime
                        
                        final_sig = signal.replace("ANTI_", "").replace("COMPRA ", "BUY ").replace("VENTA ", "SELL ")
                        print(f"    └─ [ORDEN] {signal} | TP {tp_val:.2f} | SL {sl_val:.2f}")

                        # Definir asset name explícito
                        target_asset_internal = 'ORO' if (es_long and last_asset == 'ORO') or (not es_long and last_asset != 'ORO') else 'PLATA'
                        broker.execute_trade(final_sig, asset_name=target_asset_internal, strength=engine.risk_level, sl_target=sl_val, tp_target=tp_val, risk_rules=risk_rules)
                        
                        nice_signal = signal.replace("ANTI_", "").replace("_", " ")
                        log_trade_local(f"ORDEN: {nice_signal} | Strat: {active_strat_at_trade} | Asset: {last_asset} | Side: {last_side}")
                
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
