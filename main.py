import time
from engine import TradeEngine
import broker

def main():
    engine = TradeEngine()
    print("Iniciando bot de trading (Oro/Plata)...")
    
    # 1. Verificar la conexión con Bitget antes de empezar el bucle
    if not broker.check_connection():
        print("El bot se detendrá porque no hay conexión con el Broker.")
        return

    while True:
        try:
            # 2. Pedir precios al broker
            xauusdt_price, xagusdt_price = broker.get_prices()
            
            # Si no hay precios (por ejemplo, símbolo no existe en testnet temporalmente), saltar ciclo iteración sin fallar
            if xauusdt_price is None or xagusdt_price is None:
                print("No se pudieron obtener precios válidos, reintentando...")
            else:
                # 3. Pasar precios a engine.py para procesarlos
                signal, ratio, z_score = engine.process_prices(xauusdt_price, xagusdt_price)
                
                # 4. Imprimir en pantalla el estado actual
                print(f"Ratio Actual: {ratio:.4f} | Z-Score: {z_score:.4f} | Estado: {signal}")
                
                # 5. Ejecutar trade si el Z-Score cruza los umbrales
                if signal in ['COMPRA ORO', 'COMPRA PLATA']:
                    print(f">>> Ejecutando orden de Scalping en Broker: {signal} <<<")
                    # Pasamos un SL de 0.2% (0.002) y TP de 0.4% (0.004) como solicitó el usuario
                    broker.execute_trade(signal, stop_loss_pct=0.002, take_profit_pct=0.004)
                    
        except Exception as e:
            # Manejo de errores (ej. caída de internet) para que intente de nuevo
            print(f"Error detectado durante el ciclo: {e}. Reintentando en breve...")
            
        # 6. Esperar 10 segundos antes de la siguiente revisión
        time.sleep(10)

if __name__ == "__main__":
    main()
