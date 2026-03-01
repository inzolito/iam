import numpy as np
from collections import deque

class TradeEngine:
    def __init__(self, initial_window=20, max_window=100, risk_level=2):
        self.window_size = initial_window
        self.max_window = max_window
        self.ratios = deque(maxlen=max_window)
        
        # Risk levels
        self.risk_level = risk_level
        self.thresholds = {1: 2.5, 2: 2.0, 3: 1.5}
        self.entry_threshold = self.thresholds.get(risk_level, 2.0)
        
        # --- TERMODINÁMICA Y NIVELES (Plan A vs B) ---
        self.plan_a_history = deque(maxlen=10) # Memoria de 10 trades (Usuario)
        self.plan_b_history = deque(maxlen=10)
        self.active_strategy = 'PLAN_A' 
        self.last_z_signal = 0

    def seed_history(self, results):
        """ Llena el historial inicial con trades pasados (Semilla) """
        for r in results:
            # Por defecto asumimos que el historial pasado era del Plan A
            self.plan_a_history.append(r)
        
        # Recalcular estrategia activa tras la semilla
        self.record_outcome('PLAN_A', results[-1] if results else 0.5)

    def _calculate_weighted_wr(self, history):
        if not history: return 0.5
        # Pesos exponenciales para dar más importancia a lo reciente
        # Para 10 elementos, el último tiene más peso.
        weights = np.linspace(0.5, 1.0, len(history))
        return np.average(list(history), weights=weights)

    def record_outcome(self, strategy_used, result):
        if strategy_used == 'PLAN_A': self.plan_a_history.append(result)
        else: self.plan_b_history.append(result)
        
        win_rate_a = self._calculate_weighted_wr(self.plan_a_history)
        win_rate_b = self._calculate_weighted_wr(self.plan_b_history)
        
        # El bot pivota hacia el equilibrio termodinámico (Mínimo 3 trades para reaccionar rápido)
        if len(self.plan_a_history) >= 3 or len(self.plan_b_history) >= 3:
            # Si Plan A (Reversión) está sufriendo (< 50% WR), damos oportunidad al Plan B (Momentum)
            if self.active_strategy == 'PLAN_A' and win_rate_a < 0.50:
                print(f"[IA] 🔄 CAMBIO ESTRATEGIA: Plan A rindiendo {win_rate_a:.2f}. Activando Plan B (Momentum).")
                self.active_strategy = 'PLAN_B'
            # Si Plan B rinde mejor que A por margen claro, cambiamos a B
            elif win_rate_b > (win_rate_a + 0.10):
                if self.active_strategy != 'PLAN_B':
                    print(f"[IA] 🔄 CAMBIO ESTRATEGIA: Plan B ({win_rate_b:.2f}) superior a Plan A ({win_rate_a:.2f}).")
                self.active_strategy = 'PLAN_B'
            # Si Plan A es aceptable, volvemos a la base
            elif win_rate_a >= 0.50:
                if self.active_strategy != 'PLAN_A':
                    print(f"[IA] 🔄 VOLVIENDO A PLAN A: Rendimiento sólido ({win_rate_a:.2f})")
                self.active_strategy = 'PLAN_A'

    def process_prices(self, xauusdt_price: float, xagusdt_price: float, current_pos=0):
        if xagusdt_price <= 0: return 'ESPERAR', 0, 0, 0, 'N/A', 0, 0
            
        current_ratio = xauusdt_price / xagusdt_price
        self.ratios.append(current_ratio)
        
        if len(self.ratios) < self.window_size:
            return 'ESPERAR', current_ratio, 0.0, 0, self.active_strategy, 0, 0
            
        ratios_list = list(self.ratios)
        ratios_array = np.array(ratios_list[-self.window_size:])
        mean = np.mean(ratios_array)
        std_dev = np.std(ratios_array)
        
        # -- CÁLCULO DE SOPORTES Y RESISTENCIAS (EXTREMOS) --
        # Buscamos el máximo y mínimo de los últimos 50 periodos para "abrir y cerrar"
        local_high = np.max(ratios_list)
        local_low = np.min(ratios_list)
        
        if std_dev == 0: return 'ESPERAR', current_ratio, 0.0, 0, self.active_strategy, local_high, local_low
            
        z_score = (current_ratio - mean) / std_dev
        abs_z = abs(z_score)
        strength = self._calculate_strength(abs_z)

        signal = 'ESPERAR'
        
        if self.active_strategy == 'PLAN_A':
            # PLAN A (Reversión): Vender en Resistencia, Comprar en Soporte
            # Relajamos levemente el filtro de 'proximidad al borde' para Shorts
            if z_score > self.entry_threshold and current_ratio >= local_high * 0.995:
                signal = 'SHORT POS' if current_pos == 0 else 'SCALE_IN_SHORT_POS'
            elif z_score < -self.entry_threshold and current_ratio <= local_low * 1.005:
                signal = 'LONG POS' if current_pos == 0 else 'SCALE_IN_POS'
            
            # --- MODO SONDA (Data Probe) ---
            # Corregido: Usamos 'and' para evitar el sesgo constante del MACD
            elif current_pos == 0:
                rsi, macd, sma = self._calculate_indicators(list(self.ratios))
                if rsi > 65 and macd < 0: signal = 'SONDA_SHORT'
                elif rsi < 35 and macd > 0: signal = 'SONDA_LONG'
                
        else:
            # PLAN B (Anti-Plan / Momentum)
            if z_score > 1.2 and current_ratio > local_high * 0.998:
                signal = 'LONG POS' if current_pos == 0 else 'SCALE_IN_POS'
            elif z_score < -1.2 and current_ratio < local_low * 1.002:
                signal = 'SHORT POS' if current_pos == 0 else 'SCALE_IN_SHORT_POS'
            elif current_pos == 0:
                # En Plan B, la sonda sigue la tendencia confirmada
                rsi, macd, sma = self._calculate_indicators(list(self.ratios))
                if rsi > 55 and macd > 0: signal = 'SONDA_LONG'
                elif rsi < 45 and macd < 0: signal = 'SONDA_SHORT'

        return signal, current_ratio, z_score, strength, self.active_strategy, local_high, local_low

    def _calculate_strength(self, abs_z):
        if abs_z >= 3.5: return 4
        elif abs_z >= 3.0: return 3
        elif abs_z >= 2.5: return 2
        elif abs_z >= 2.0: return 1
        return 0

    def _calculate_indicators(self, data):
        """ Calcula indicadores técnicos tradicionales sobre el ratio o precio """
        if len(data) < 20: return 0, 0, 0
        
        # 1. RSI (14)
        delta = np.diff(data)
        gain = (delta > 0) * delta
        loss = (delta < 0) * -delta
        avg_gain = np.mean(gain[-14:])
        avg_loss = np.mean(loss[-14:])
        rs = avg_gain / (avg_loss if avg_loss > 0 else 0.001)
        rsi = 100 - (100 / (1 + rs))
        
        # 2. SMA (20)
        sma = np.mean(data[-20:])
        
        # 3. MACD (Básico 12,26,9)
        if len(data) >= 26:
            ema12 = np.mean(data[-12:])
            ema26 = np.mean(data[-26:])
            macd = ema12 - ema26
        else:
            macd = 0
            
        return rsi, macd, sma

    def get_logic_snapshot(self, z_score, ratio, l_high, l_low):
        """ Retorna bitácora matemática profunda con indicadores extra """
        win_rate_a = sum(self.plan_a_history) / len(self.plan_a_history) if self.plan_a_history else 0.5
        win_rate_b = sum(self.plan_b_history) / len(self.plan_b_history) if self.plan_b_history else 0.5
        
        rsi, macd, sma = self._calculate_indicators(list(self.ratios))
        
        dist_high = (l_high - ratio) / (l_high if l_high > 0 else 1) * 100
        dist_low = (ratio - l_low) / (l_low if l_low > 0 else 1) * 100
        
        return {
            'strategy': self.active_strategy,
            'win_rate_a': win_rate_a,
            'win_rate_b': win_rate_b,
            'z_score': z_score,
            'rsi': rsi,
            'macd': macd,
            'sma': sma,
            'dist_high_percent': dist_high,
            'dist_low_percent': dist_low,
            'cointegration': self.check_cointegrated_logic()
        }

    def check_cointegrated_logic(self):
        if len(self.ratios) < 50: return True
        std = np.std(list(self.ratios)[-30:])
        return std < np.std(self.ratios) * 5.0
