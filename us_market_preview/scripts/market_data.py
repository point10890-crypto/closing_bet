#!/usr/bin/env python3
"""
Fetches real-time data for major indices, bonds, currencies, commodities.
Calculates a simple Fear & Greed score from VIX.
Output: output/market_data.json
"""
import yfinance as yf
import json, os
from datetime import datetime

TICKERS = {
    'indices': {'SPY': 'S&P 500', 'QQQ': 'NASDAQ 100', 'DIA': 'Dow Jones', 'IWM': 'Russell 2000'},
    'volatility': {'^VIX': 'VIX'},
    'bonds': {'^TNX': '10Y Treasury'},
    'currencies': {'DX-Y.NYB': 'Dollar Index', 'USDKRW=X': 'USD/KRW'},
    'commodities': {'GC=F': 'Gold', 'BTC-USD': 'Bitcoin'},
}

def fetch_market_data():
    result = {'timestamp': datetime.now().isoformat()}
    for category, tickers in TICKERS.items():
        result[category] = {}
        for symbol, name in tickers.items():
            try:
                hist = yf.Ticker(symbol).history(period='5d')
                if hist.empty: continue
                current = float(hist['Close'].iloc[-1])
                prev = float(hist['Close'].iloc[-2]) if len(hist) > 1 else current
                result[category][symbol] = {
                    'name': name,
                    'price': round(current, 2),
                    'change': round(((current / prev) - 1) * 100, 2),
                }
            except Exception as e:
                print(f"  Skipping {symbol}: {e}")

    vix = result.get('volatility', {}).get('^VIX', {}).get('price', 20)
    if vix <= 12: score, level = 85, 'Extreme Greed'
    elif vix <= 17: score, level = 70, 'Greed'
    elif vix <= 22: score, level = 50, 'Neutral'
    elif vix <= 30: score, level = 30, 'Fear'
    else: score, level = 10, 'Extreme Fear'
    result['fear_greed'] = {'score': score, 'level': level, 'vix': round(vix, 1)}

    output_path = os.path.join(os.path.dirname(__file__), '..', 'output', 'market_data.json')
    os.makedirs(os.path.dirname(output_path), exist_ok=True)
    with open(output_path, 'w', encoding='utf-8') as f:
        json.dump(result, f, ensure_ascii=False, indent=2)
    print("Saved market data")

if __name__ == '__main__':
    fetch_market_data()
