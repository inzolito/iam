import os
import requests
from dotenv import load_dotenv
import json

load_dotenv()

TOKEN = os.getenv("METAAPI_TOKEN")

def test_connection():
    if not TOKEN:
        print("Error: METAAPI_TOKEN not found in .env")
        return
    
    url = "https://mt-provisioning-api-v1.agiliumtrade.agiliumtrade.ai/users/current/accounts"
    headers = {"auth-token": TOKEN}
    
    try:
        response = requests.get(url, headers=headers)
        print(f"Status Code: {response.status_code}")
        
        if response.status_code == 200:
            accounts = response.json()
            print(f"Accounts found: {len(accounts)}")
            for acc in accounts:
                print(f"- ID: {acc.get('_id')}, Name: {acc.get('name')}, Login: {acc.get('login')}, State: {acc.get('state')}, Connection: {acc.get('connectionStatus')}")
        else:
            print("Failed to authenticate or fetch accounts.")
            print(response.text)
    except Exception as e:
        print(f"Exception occurred: {e}")

if __name__ == "__main__":
    test_connection()
