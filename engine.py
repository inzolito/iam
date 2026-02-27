import numpy as np
from collections import deque

class TradeEngine:
    def __init__(self, window_size=20):
        # Mantiene una lista de los últimos 20 ratios (ventana de tiempo)
        self.ratios = deque(maxlen=window_size)
    
    def process_prices(self, xauusdt_price: float, xagusdt_price: float):
        """
        Recibe los precios de XAUUSDT (Oro) y XAGUSDT (Plata).
        Calcula el ratio, actualiza la ventana y devuelve una tupla: (señal, ratio, z_score)
        """
        if xagusdt_price <= 0:
            raise ValueError("El precio de la plata (XAGUSDT) debe ser mayor a 0.")
            
        # Calcular el Ratio (Oro/Plata)
        current_ratio = xauusdt_price / xagusdt_price
        self.ratios.append(current_ratio)
        
        # Necesitamos al menos 2 datos dentro de la ventana del historial para calcular la desviación estándar
        if len(self.ratios) < 2:
            return 'ESPERAR', current_ratio, 0.0
            
        # Pasar la cola temporal a un array de numpy para cálculos exactos
        ratios_array = np.array(self.ratios)
        
        # Calcular media y desviación estándar
        mean = np.mean(ratios_array)
        std_dev = np.std(ratios_array)
        
        # Evitar división por cero si todos los ratios del historial son exactamente iguales
        if std_dev == 0:
            return 'ESPERAR', current_ratio, 0.0
            
        # Calcular el Z-Score
        z_score = (current_ratio - mean) / std_dev
        
        # Retornar señal en base al umbral de Z= 2.0 y -2.0
        if z_score > 2.0:
            return 'COMPRA PLATA', current_ratio, z_score
        elif z_score < -2.0:
            return 'COMPRA ORO', current_ratio, z_score
        else:
            return 'ESPERAR', current_ratio, z_score
