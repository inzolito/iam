import ccxt
exchange = ccxt.bitget({'options': {'defaultType': 'swap'}})
exchange.set_sandbox_mode(True)
exchange.load_markets()
xau_symbols = [s for s in exchange.symbols if 'XAU' in s]
xag_symbols = [s for s in exchange.symbols if 'XAG' in s]
print(f"XAU: {xau_symbols}")
print(f"XAG: {xag_symbols}")
