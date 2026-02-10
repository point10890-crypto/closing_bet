#!/usr/bin/env python3
"""
Screens top 50 S&P 500 stocks with basic factors.
Output: output/top_picks.json
"""
import yfinance as yf
import pandas as pd
import numpy as np
import json, os
from datetime import datetime

def calc_rsi(prices, period=14):
    delta = prices.diff()
    gain = delta.clip(lower=0).rolling(period).mean()
    loss = (-delta.clip(upper=0)).rolling(period).mean()
    rs = gain / loss.replace(0, np.nan)
    return 100 - (100 / (1 + rs))

def screen_stocks():
    tickers = ['AAPL','MSFT','GOOGL','AMZN','NVDA','META','TSLA','JPM','UNH','JNJ',
               'V','PG','MA','HD','MRK','ABBV','PEP','KO','COST','AVGO','WMT','MCD',
               'CSCO','ACN','LIN','TMO','ABT','CRM','DHR','NKE','AMD','TXN','NEE',
               'PM','UNP','RTX','HON','LOW','SPGI','INTU','ISRG','BLK','AMAT','GS',
               'ELV','MDLZ','ADP','VRTX','REGN','BRK-B']
    results = []
    for i, ticker in enumerate(tickers):
        try:
            tk = yf.Ticker(ticker)
            hist = tk.history(period='1y')
            if len(hist) < 60: continue
            info = tk.info
            close = hist['Close']
            price = float(close.iloc[-1])
            rsi = float(calc_rsi(close).iloc[-1])
            inst_pct = info.get('heldPercentInstitutions', 0) or 0
            rev_growth = info.get('revenueGrowth', 0) or 0
            ma50 = float(close.rolling(50).mean().iloc[-1])
            composite = np.mean([
                80 if 40 <= rsi <= 65 else 40,
                min(100, inst_pct * 100),
                min(100, max(0, 50 + rev_growth * 200)),
                85 if price > ma50 else 35,
            ])
            results.append({
                'ticker': ticker, 'name': info.get('shortName', ticker),
                'sector': info.get('sector', 'Unknown'),
                'price': round(price, 2), 'composite_score': round(composite, 1),
                'rsi': round(rsi, 1),
            })
            if (i + 1) % 10 == 0: print(f"{i+1}/{len(tickers)}")
        except: pass

    results.sort(key=lambda x: x['composite_score'], reverse=True)
    for i, p in enumerate(results[:10]):
        p['rank'] = i + 1
        p['grade'] = 'A' if p['composite_score'] >= 75 else ('B' if p['composite_score'] >= 65 else 'C')
        p['signal'] = 'Strong Buy' if p['grade'] == 'A' else ('Buy' if p['grade'] == 'B' else 'Hold')

    output_path = os.path.join(os.path.dirname(__file__), '..', 'output', 'top_picks.json')
    os.makedirs(os.path.dirname(output_path), exist_ok=True)
    with open(output_path, 'w', encoding='utf-8') as f:
        json.dump({'timestamp': datetime.now().isoformat(), 'top_picks': results[:10]}, f, indent=2)
    print(f"Saved top 10 picks")

if __name__ == '__main__':
    screen_stocks()
