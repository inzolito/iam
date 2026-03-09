import requests
import sqlite3
import os
import datetime
from dotenv import load_dotenv

load_dotenv()

DB_PATH = os.path.join(os.path.dirname(os.path.abspath(__file__)), "bot_analytics.db")

class NewsManager:
    def __init__(self):
        # Usaremos Alpha Vantage como fuente gratuita inicial (requiere API Key en el .env si se quiere más cuota)
        # Por ahora usaremos un feed público configurado
        self.api_key = os.getenv("ALPHA_VANTAGE_KEY", "DEMO") 
        self.sources = [
            "https://www.investing.com/rss/news_285.rss", # Forex News
            "https://www.investing.com/rss/market_overview.rss"
        ]

    def fetch_rss_news(self):
        """Obtiene noticias vía RSS (Gratis y sin API Keys complejas)"""
        import xml.etree.ElementTree as ET
        
        all_news = []
        for url in self.sources:
            try:
                response = requests.get(url, timeout=10)
                if response.status_code == 200:
                    root = ET.fromstring(response.content)
                    for item in root.findall('./channel/item'):
                        title = item.find('title').text
                        link = item.find('link').text
                        pub_date = item.find('pubDate').text
                        desc = item.find('description').text if item.find('description') is not None else ""
                        
                        all_news.append({
                            'title': title,
                            'impact': 'MEDIUM', # No especificado en RSS, lo marcamos como medio
                            'date': pub_date,
                            'desc': desc[:200],
                            'source': 'Investing RSS'
                        })
            except Exception as e:
                print(f"[NEWS] Error fetching RSS {url}: {e}")
        return all_news

    def save_news_to_db(self, news_list):
        try:
            conn = sqlite3.connect(DB_PATH)
            cursor = conn.cursor()
            
            # Crear tabla si no existe
            cursor.execute('''
                CREATE TABLE IF NOT EXISTS macro_news (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    title TEXT NOT NULL,
                    impact TEXT,
                    event_date TEXT,
                    description TEXT,
                    source TEXT,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                )
            ''')
            
            # Limpiar noticias viejas (> 48h) para no saturar
            cursor.execute("DELETE FROM macro_news WHERE created_at < datetime('now', '-2 days')")
            
            for news in news_list:
                # Evitar duplicados por título
                cursor.execute("SELECT id FROM macro_news WHERE title = ?", (news['title'],))
                if not cursor.fetchone():
                    cursor.execute('''
                        INSERT INTO macro_news (title, impact, event_date, description, source)
                        VALUES (?, ?, ?, ?, ?)
                    ''', (news['title'], news['impact'], news['date'], news['desc'], news['source']))
            
            conn.commit()
            conn.close()
            return True
        except Exception as e:
            print(f"[NEWS] Error saving to DB: {e}")
            return False

    def get_latest_news_context(self, limit=5):
        """Devuelve un string con las últimas noticias para la IA"""
        try:
            conn = sqlite3.connect(DB_PATH)
            conn.row_factory = sqlite3.Row
            rows = conn.execute('SELECT title, impact, event_date FROM macro_news ORDER BY id DESC LIMIT ?', (limit,)).fetchall()
            conn.close()
            
            if not rows:
                return "No hay noticias macro recientes."
            
            context = "NOTICIAS MACRO RECIENTES:\n"
            for r in rows:
                context += f"- [{r['impact']}] {r['title']} ({r['event_date']})\n"
            return context
        except:
            return "Error recuperando contexto de noticias."

if __name__ == "__main__":
    manager = NewsManager()
    print("[NEWS] Iniciando recolección de noticias...")
    news = manager.fetch_rss_news()
    if news:
        print(f"[NEWS] {len(news)} noticias encontradas. Guardando...")
        if manager.save_news_to_db(news):
            print("[NEWS] Proceso completado exitosamente.")
    else:
        print("[NEWS] No se encontraron noticias nuevas.")
