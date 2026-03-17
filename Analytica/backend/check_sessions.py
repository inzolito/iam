from sqlalchemy import create_engine, text
DATABASE_URL = 'postgresql://postgres:AnalyticaRootPW123!@34.55.159.178:5432/analytica'
engine = create_engine(DATABASE_URL)

def _session(hour):
    if 0 <= hour < 8: return 'Asia'
    if 8 <= hour < 13: return 'Londres'
    if 13 <= hour < 17: return 'London/NY'
    if 17 <= hour < 22: return 'Nueva York'
    return 'Fuera de sesión'

with engine.connect() as conn:
    res = conn.execute(text('''
        SELECT 
            extract(hour from open_time) as hour,
            net_profit
        FROM trades 
        WHERE account_id = 'fa8f54c2-f0b3-4c01-9202-46859e517327'
        AND date(close_time AT TIME ZONE 'UTC') = '2026-03-10'
    '''))
    
    sess_stats = {}
    for row in res:
        s = _session(row.hour)
        if s not in sess_stats: sess_stats[s] = {'pnl': 0, 'count': 0}
        sess_stats[s]['pnl'] += float(row.net_profit)
        sess_stats[s]['count'] += 1
    
    print('Session Stats (UTC 2026-03-10):')
    for s, stats in sess_stats.items():
        print(f'  {s}: PNL={stats["pnl"]:.2f}, Count={stats["count"]}')
