import broker
import json

def debug_positions():
    try:
        if not broker.check_connection():
            print("Connection failed")
            return
            
        positions = broker.exchange.fetch_positions(params={'productType': 'usdt-futures'})
        print("Raw Positions Data (First one):")
        if positions:
            active = [p for p in positions if float(p.get('contracts', 0)) > 0]
            if active:
                print(json.dumps(active[0], indent=2))
                print("\nKeys available in p:")
                print(active[0].keys())
            else:
                print("No active positions found.")
        else:
            print("Zero positions returned from fetch_positions")
            
    except Exception as e:
        print(f"Error: {e}")

if __name__ == "__main__":
    debug_positions()
