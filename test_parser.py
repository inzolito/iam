import sys

def test_parse():
    lines = [
        "2026-02-27 23:22:50 | ORDEN: SCALE IN ORO | Strat: PLAN_A | Asset: ORO | Side: LONG\n",
        "2026-02-27 23:23:00 | RESULTADO: FALLO | Strat: PLAN_A | Asset: ORO | Side: LONG | Bal: $398.42903709\n",
        "2026-02-27 21:55:27 | RESULTADO: ÉXITO | Strat: PLAN_A | Asset: ORO | Side: SHORT | Bal: $414.21492404\n"
    ]
    
    results = [l for l in lines if "RESULTADO:" in l]
    print(f"Results len: {len(results)}")
    
    wins = [r for r in results if "ÉXITO" in r]
    loss = [r for r in results if "FALLO" in r]
    print(f"Wins: {len(wins)}, Loss: {len(loss)}")
    
    res_oro = [r for r in results if "Asset: ORO" in r]
    res_plata = [r for r in results if "Asset: PLATA" in r]
    res_long = [r for r in results if "Side: LONG" in r]
    res_short = [r for r in results if "Side: SHORT" in r]
    
    print(f"Oro: {len(res_oro)}, Plata: {len(res_plata)}")
    print(f"Long: {len(res_long)}, Short: {len(res_short)}")
    
    res_a = [r for r in results if "Strat: PLAN_A" in r]
    print(f"Plan A: {len(res_a)}")

if __name__ == "__main__":
    test_parse()
