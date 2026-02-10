#!/usr/bin/env python3
"""
Collects sector ETF performance for heatmap.
Output: output/sector_heatmap.json
"""
import yfinance as yf
import json, os
from datetime import datetime

SECTORS = {
    'XLK': 'Technology', 'XLF': 'Financials', 'XLV': 'Healthcare',
    'XLE': 'Energy', 'XLI': 'Industrials', 'XLY': 'Consumer Disc.',
    'XLP': 'Consumer Staples', 'XLU': 'Utilities', 'XLRE': 'Real Estate',
    'XLB': 'Materials', 'XLC': 'Communication',
}

def fetch_sector_data():
    sectors = []
    for ticker, name in SECTORS.items():
        try:
            hist = yf.Ticker(ticker).history(period='5d')
            if hist.empty or len(hist) < 2: continue
            current = float(hist['Close'].iloc[-1])
            prev = float(hist['Close'].iloc[-2])
            change = ((current / prev) - 1) * 100
            sectors.append({'ticker': ticker, 'name': name, 'price': round(current, 2), 'change': round(change, 2)})
        except: pass
    sectors.sort(key=lambda x: x['change'], reverse=True)
    output_path = os.path.join(os.path.dirname(__file__), '..', 'output', 'sector_heatmap.json')
    os.makedirs(os.path.dirname(output_path), exist_ok=True)
    with open(output_path, 'w') as f:
        json.dump({'timestamp': datetime.now().isoformat(), 'sectors': sectors}, f, indent=2)
    print(f"Saved {len(sectors)} sectors")

if __name__ == '__main__':
    fetch_sector_data()
