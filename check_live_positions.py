import broker
import os
from dotenv import load_dotenv
load_dotenv()
try:
    print(broker.get_open_positions_details())
except Exception as e:
    print(f"Error: {e}")
