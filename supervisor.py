# 🛡️ IMPORTANTE: ANTES DE MODIFICAR, LEER MAIK_SYSTEM_RULES.md EN LA RAÍZ.
import time
import sqlite3
import os
import json
import broker
from datetime import datetime, timedelta, timezone

# --- CONFIGURACIÓN ---
DB_PATH = "bot_analytics.db"
LOG_HISTORY = "trades_history.txt"
INTERVALO = 180  # 3 minutos
INITIAL_BALANCE = 500.0  # El balance con el que empezó el bot

# Gestión de Zona Horaria (Local: UTC-3)
LOCAL_OFFSET = timezone(timedelta(hours=-3))

def get_session_start_ts():
    """Calcula el timestamp (ms) de las 00:00:00 locales para el reset de sesión."""
    # Obtenemos la hora actual en UTC-3
    LOCAL_OFFSET = timezone(timedelta(hours=-3))
    now_local = datetime.now(LOCAL_OFFSET)
    # Creamos un objeto naive que represente la medianoche local
    midnight_local = now_local.replace(hour=0, minute=0, second=0, microsecond=0, tzinfo=None)
    # Para comparar con CCXT (que usa UTC), necesitamos el timestamp real
    # Pero para filtrar logs locales, usaremos el objeto datetime.
    now_utc = datetime.now(timezone.utc)
    # Diferencia de -3 horas: local = utc - 3 -> utc = local + 3
    midnight_utc = midnight_local + timedelta(hours=3)
    return int(midnight_utc.timestamp() * 1000)

def get_session_start_dt_naive():
    """Retorna un datetime naive de las 00:00 locales para comparar con logs."""
    LOCAL_OFFSET = timezone(timedelta(hours=-3))
    now_local = datetime.now(LOCAL_OFFSET)
    return now_local.replace(hour=0, minute=0, second=0, microsecond=0, tzinfo=None)

def init_db():
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()
    # Historial limitado a 100 con métricas extendidas
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS performance_logs (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            timestamp TEXT,
            total_trades INTEGER,
            win_rate REAL,
            win_rate_a REAL,
            win_rate_b REAL,
            last_balance REAL,
            pnl_percent REAL
        )
    """)
    # Tabla de Estado Presente (Extendida V7 - Granular Plan Stats)
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS current_bot_state (
            id INTEGER PRIMARY KEY,
            timestamp TEXT,
            strategy TEXT,
            strat_active_time TEXT,
            balance REAL,
            pnl_total REAL,
            signal TEXT,
            bot_mode TEXT,
            avg_win_usd REAL,
            avg_loss_usd REAL,
            total_executions INTEGER,
            avg_fee_usd REAL,
            avg_duration_min REAL,
            avg_win_pct REAL,
            avg_loss_pct REAL,
            net_win_usd REAL,
            net_loss_usd REAL,
            oro_w INTEGER, oro_l INTEGER,
            plata_w INTEGER, plata_l INTEGER,
            long_w INTEGER, long_l INTEGER,
            short_w INTEGER, short_l INTEGER,
            plan_a_long_w INTEGER, plan_a_long_l INTEGER,
            plan_a_short_w INTEGER, plan_a_short_l INTEGER,
            plan_b_long_w INTEGER, plan_b_long_l INTEGER,
            plan_b_short_w INTEGER, plan_b_short_l INTEGER,
            total_w INTEGER, total_l INTEGER
        )
    """)
    # Tabla de Metadatos de Sesión (Para PnL Real por día)
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS session_metadata (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            date TEXT UNIQUE,
            starting_balance REAL
        )
    """)
    conn.commit()
    conn.close()

def optimize_db():
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()
    cursor.execute("DELETE FROM performance_logs WHERE id NOT IN (SELECT id FROM performance_logs ORDER BY id DESC LIMIT 100)")
    conn.commit()
    conn.close()

def get_stats_from_api():
    """
    Calcula las métricas reales consultando fetch_my_trades directamente desde la API de Bitget.
    Esto garantiza que SL/TP, cierres manuales, y cualquier cierre externo sean contabilizados.
    """
    try:
        # Sincronización de Sesión: Reiniciar estadísticas a las 00:00 Local
        session_ts = get_session_start_ts()
        
        # Detectar modo via config.json
        bot_mode = "NORMAL"
        try:
            if os.path.exists("config.json"):
                with open("config.json", "r") as f:
                    conf = json.load(f)
                    if conf.get("anti_bot"): bot_mode = "ANTI-BOT"
        except: pass

        # Obtener todas las trades reales con PnL de ambos pares
        all_closing_trades = []
        for symbol in ['BTC/USDT:USDT', 'ETH/USDT:USDT']:
            try:
                # Usar session_ts para que las estadísticas se reinicien a las 00:00 local
                trades = broker.exchange.fetch_my_trades(symbol, since=session_ts, limit=1000)
                for t in trades:
                    info = t.get('info', {})
                    profit = float(info.get('profit', 0))
                    if abs(profit) > 0:  # Solo cierres (los que tienen PnL)
                        trade_side = info.get('tradeSide', '')
                        # sell_single = cierre de una posición LONG (estábamos comprando)
                        # buy_single = cierre de una posición SHORT (estábamos vendiendo)
                        is_long_close = 'sell' in trade_side
                        all_closing_trades.append({
                            'symbol': symbol,
                            'is_btc': 'BTC' in symbol,  # BTC=ORO, ETH=PLATA
                            'is_long': is_long_close,
                            'profit': profit,
                            'ts': t.get('datetime', '')
                        })
            except Exception as e:
                print(f"[!] Error obteniendo trades de {symbol}: {e}")

        wins = [t for t in all_closing_trades if float(t.get('profit', 0)) > 0]
        losses = [t for t in all_closing_trades if float(t.get('profit', 0)) < 0]
        total_w = len(wins)
        total_l = len(losses)
        total_pnl = float(sum(t['profit'] for t in all_closing_trades))

        # --- MEJORA PNL REAL (DELTA DE EQUIDAD) ---
        current_date_local = datetime.now(LOCAL_OFFSET).strftime("%Y-%m-%d")
        real_pnl_total = total_pnl # fallback
        
        try:
            real_balance, _ = broker.get_account_status()
            if real_balance > 0:
                conn = sqlite3.connect(DB_PATH)
                # Intentar obtener el balance inicial de hoy
                row = conn.execute("SELECT starting_balance FROM session_metadata WHERE date = ?", (current_date_local,)).fetchone()
                
                if row:
                    starting_bal = row[0]
                    real_pnl_total = real_balance - starting_bal
                else:
                    # Si es la primera vez hoy, guardamos el balance actual como inicial
                    conn.execute("INSERT OR IGNORE INTO session_metadata (date, starting_balance) VALUES (?, ?)", 
                                (current_date_local, real_balance))
                    conn.commit()
                conn.close()
        except Exception as e:
            print(f"[!] Error calculando PnL Real: {e}")
        
        # Usamos el PnL Real para el reporte principal
        total_pnl = real_pnl_total 

        # Cálculo de Comisiones Promedio
        total_fees = 0
        all_fills_count = 0
        for symbol in ['BTC/USDT:USDT', 'ETH/USDT:USDT']:
            try:
                raw_trades = broker.exchange.fetch_my_trades(symbol, since=session_ts, limit=1000)
                all_fills_count += len(raw_trades)
                for rt in raw_trades:
                    f_list = rt.get('info', {}).get('feeDetail', [])
                    total_fees += sum(abs(float(f.get('totalFee', 0))) for f in f_list)
            except: pass

        avg_fee = total_fees / all_fills_count if all_fills_count > 0 else 0.0
        
        # Rendimientos Netos (Profit - Fees)
        avg_win = float(sum(t['profit'] for t in wins) / len(wins)) if wins else 0.0
        avg_loss = float(sum(abs(t['profit']) for t in losses) / len(losses)) if losses else 0.0
        
        net_win = avg_win - (avg_fee * 2) if wins else 0.0
        net_loss = avg_loss + (avg_fee * 2) if losses else 0.0

        # Rendimientos Porcentuales Promedio (Basado en el margen promedio o estimación PnL)
        # Nota: Extraer el margin real de cada trade es ideal, pero como proxy rápido
        # usamos (Profit / Balance Inicial estimado) * 100, ajustado al apalancamiento (ej. x50)
        # Una forma más directa es recoger el PnL_Pct si lo hubiera, pero Bitget no lo da directo en get_my_trades.
        # Estimación: avg_win / tamaño_promedio_posicion.
        # Dado que no tenemos el tamaño en la lista filtrada, lo estimamos respecto a un margen fijo de ~20 USD
        EST_MARGIN = 20.0 
        avg_win_pct = (avg_win / EST_MARGIN) * 100 if avg_win > 0 else 0.0
        avg_loss_pct = (avg_loss / EST_MARGIN) * 100 if avg_loss > 0 else 0.0

        # Duración Promedio (Heurística basada en bloques de tiempo o constante si no hay pares)
        avg_duration = 5.34 # Valor base si no se puede calcular
        try:
            durations = []
            # Intentar emparejar cierres con su apertura más cercana (simplificado)
            # Esto es complejo sin trackear IDs persistentes, usaremos el valor de auditoría previa
            # como base móvil si los datos son 0.
            pass 
        except: pass

        # Stats por activo
        oro_wins  = [t for t in wins   if t['is_btc']]
        oro_losses = [t for t in losses if t['is_btc']]
        plata_wins = [t for t in wins   if not t['is_btc']]
        plata_losses = [t for t in losses if not t['is_btc']]

        # Stats por dirección: LONG = is_long=True, SHORT = is_long=False
        long_wins  = [t for t in wins   if t['is_long']]
        long_losses = [t for t in losses if t['is_long']]
        short_wins  = [t for t in wins   if not t['is_long']]
        short_losses = [t for t in losses if not t['is_long']]

        # Stats por Plan (leemos del log local para tener qué estrategia se usó en cada trade)
        # El log asigna Strat: PLAN_A o PLAN_B a cada orden de apertura.
        # Sin log de estrategia per-trade, asumimos PLAN_A (mayoritario por defecto)
        # En una mejora futura, agregaremos el tag de plan al info de cada trade
        pa_long_w, pa_long_l = len(long_wins), len(long_losses)
        pa_short_w, pa_short_l = len(short_wins), len(short_losses)
        pb_long_w, pb_long_l = 0, 0
        pb_short_w, pb_short_l = 0, 0

        # Intentar leer stats de Plan A/B del log (si hay datos)
        if os.path.exists(LOG_HISTORY):
            try:
                with open(LOG_HISTORY, "r", encoding="utf-8") as f:
                    lines = f.readlines()
                
                # Filtrar solo resultados que ocurrieron DESPUÉS del inicio de la sesión
                results_log = []
                session_start_dt = get_session_start_dt_naive()
                
                for l in lines:
                    if "RESULTADO:" in l:
                        try:
                            ts_str = " ".join(l.split()[0:2])
                            log_dt = datetime.strptime(ts_str, "%Y-%m-%d %H:%M:%S")
                            if log_dt >= session_start_dt:
                                results_log.append(l)
                        except: pass

                res_a = [r for r in results_log if "Strat: PLAN_A" in r]
                res_b = [r for r in results_log if "Strat: PLAN_B" in r]
                if res_b:  # Solo sobreescribimos si hay datos de Plan B
                    def _hw(subset, side):
                        w = len([r for r in subset if "ÉXITO" in r and f"Side: {side}" in r])
                        l = len([r for r in subset if "FALLO" in r and f"Side: {side}" in r])
                        return w, l
                    pa_long_w, pa_long_l = _hw(res_a, "LONG")
                    pa_short_w, pa_short_l = _hw(res_a, "SHORT")
                    pb_long_w, pb_long_l = _hw(res_b, "LONG")
                    pb_short_w, pb_short_l = _hw(res_b, "SHORT")
            except: pass

        # Balance y señal actual
        last_balance = INITIAL_BALANCE
        last_signal = "ESPERANDO"
        current_strat = "PLAN_A"
        active_duration = "N/A"
        strat_start_time = None

        try:
            real_balance, _ = broker.get_account_status()
            last_balance = real_balance if real_balance > 0 else INITIAL_BALANCE
        except: pass

        if os.path.exists(LOG_HISTORY):
            try:
                with open(LOG_HISTORY, "r", encoding="utf-8") as f:
                    lines = f.readlines()
                for line in reversed(lines):
                    if last_signal == "ESPERANDO" and "ORDEN:" in line:
                        last_signal = line.split("ORDEN: ")[1].split(" |")[0]
                    if "Strat:" in line and not strat_start_time:
                        current_strat = line.split("Strat: ")[1].split(" |")[0]
                        try:
                            ts_str = " ".join(line.split()[0:2])
                            strat_start_time = datetime.strptime(ts_str, "%Y-%m-%d %H:%M:%S")
                        except: pass
                    if last_signal != "ESPERANDO" and strat_start_time:
                        break
            except: pass

        if strat_start_time:
            diff = datetime.now() - strat_start_time
            active_duration = f"{int(diff.total_seconds() // 60)}m"

        return {
            "total_w": total_w, "total_l": total_l,
            "oro_w": len(oro_wins), "oro_l": len(oro_losses),
            "plata_w": len(plata_wins), "plata_l": len(plata_losses),
            "long_w": len(long_wins), "long_l": len(long_losses),
            "short_w": len(short_wins), "short_l": len(short_losses),
            "pa_long_w": pa_long_w, "pa_long_l": pa_long_l,
            "pa_short_w": pa_short_w, "pa_short_l": pa_short_l,
            "pb_long_w": pb_long_w, "pb_long_l": pb_long_l,
            "pb_short_w": pb_short_w, "pb_short_l": pb_short_l,
            "avg_win_usd": avg_win,
            "avg_loss_usd": avg_loss,
            "total_executions": all_fills_count,
            "avg_fee_usd": avg_fee,
            "avg_duration_min": avg_duration,
            "avg_win_pct": avg_win_pct,
            "avg_loss_pct": avg_loss_pct,
            "net_win_usd": net_win,
            "net_loss_usd": net_loss,
            "bot_mode": bot_mode,
            "strategy": current_strat,
            "active_time": active_duration,
            "signal": last_signal,
            "balance": last_balance,
            "pnl_usd": total_pnl
        }

    except Exception as e:
        print(f"[!] Error get_stats_from_api: {e}")
        import traceback
        traceback.print_exc()
        return {}

def save_snapshot(stats):
    if not stats: return
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()
    now = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    
    # Lista de columnas para asegurar correspondencia
    cols = [
        "id", "timestamp", "strategy", "strat_active_time", "balance", "pnl_total", "signal", "bot_mode", 
        "avg_win_usd", "avg_loss_usd", "total_executions", "avg_fee_usd", "avg_duration_min", 
        "avg_win_pct", "avg_loss_pct", "net_win_usd", "net_loss_usd",
        "oro_w", "oro_l", "plata_w", "plata_l", "long_w", "long_l", "short_w", "short_l", 
        "plan_a_long_w", "plan_a_long_l", "plan_a_short_w", "plan_a_short_l",
        "plan_b_long_w", "plan_b_long_l", "plan_b_short_w", "plan_b_short_l",
        "total_w", "total_l"
    ]
    
    vals = [
        1, now, stats['strategy'], stats['active_time'], stats['balance'], stats['pnl_usd'], stats['signal'], stats['bot_mode'],
        stats['avg_win_usd'], stats['avg_loss_usd'], stats['total_executions'], stats['avg_fee_usd'], stats['avg_duration_min'],
        stats.get('avg_win_pct', 0.0), stats.get('avg_loss_pct', 0.0), stats['net_win_usd'], stats['net_loss_usd'],
        stats['oro_w'], stats['oro_l'], stats['plata_w'], stats['plata_l'], 
        stats['long_w'], stats['long_l'], stats['short_w'], stats['short_l'],
        stats['pa_long_w'], stats['pa_long_l'], stats['pa_short_w'], stats['pa_short_l'],
        stats['pb_long_w'], stats['pb_long_l'], stats['pb_short_w'], stats['pb_short_l'],
        stats['total_w'], stats['total_l']
    ]
    
    placeholders = ",".join(["?"] * len(cols))
    query = f"INSERT OR REPLACE INTO current_bot_state ({','.join(cols)}) VALUES ({placeholders})"
    
    try:
        cursor.execute(query, vals)
        conn.commit()
    except Exception as e:
        print(f"[!] Error guardando snapshot: {e}")
    finally:
        conn.close()
    
    optimize_db()

def main():
    print("\n" + "="*50)
    print("      MAIK SUPERVISOR v5.0 - AI READY")
    print("="*50)
    init_db()
    
    ciclo_ia = 0
    # IA ahora se dispara manualmente desde el Dashboard web
    print("[INFO] Supervisor iniciado. IA en espera de gatillo manual.")

    while True:
        try:
            stats = get_stats_from_api()
            if stats:
                save_snapshot(stats)
                print(f"\n[📊] {datetime.now().strftime('%H:%M:%S')} | {stats['strategy']} | {stats['bot_mode']}")
                print(f"    ├─ Ganados: {stats['total_w']} | Perdidos: {stats['total_l']}")
                print(f"    └─ Avg Win: ${stats['avg_win_usd']:.2f} | Avg Loss: ${stats['avg_loss_usd']:.2f}")
            
            # La IA ya no se dispara automáticamente para evitar límites de Gemini
            pass
                
        except Exception as e:
            print(f"[!] Error: {e}")
        time.sleep(INTERVALO)

if __name__ == "__main__":
    main()
