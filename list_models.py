from google import genai
import os
from dotenv import load_dotenv

load_dotenv()
API_KEY = os.getenv("GEMINI_API_KEY")

try:
    client = genai.Client(api_key=API_KEY)
    print("Available models:")
    for model in client.models.list():
        print(f"- {model.name}")
except Exception as e:
    print(f"Error listing models: {e}")
