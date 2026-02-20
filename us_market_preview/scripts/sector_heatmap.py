#!/usr/bin/env python3
"""
S&P 500 섹터 히트맵 + 주요 종목 등락 데이터 수집
Output: output/sector_heatmap.json

데이터 구조:
- sectors: 11개 섹터 ETF 등락률
- top_stocks: S&P 500 시가총액 상위 50개 종목 등락률 + 섹터 분류
- market_breadth: 상승/하락 비율
"""
import yfinance as yf
import json, os
from datetime import datetime
from concurrent.futures import ThreadPoolExecutor, as_completed

SECTORS = {
    'XLK': 'Technology', 'XLF': 'Financials', 'XLV': 'Healthcare',
    'XLE': 'Energy', 'XLI': 'Industrials', 'XLY': 'Consumer Disc.',
    'XLP': 'Consumer Staples', 'XLU': 'Utilities', 'XLRE': 'Real Estate',
    'XLB': 'Materials', 'XLC': 'Communication',
}

# S&P 500 시가총액 상위 50 종목
TOP_STOCKS = {
    'AAPL': ('Apple', 'Technology'),
    'MSFT': ('Microsoft', 'Technology'),
    'GOOGL': ('Alphabet', 'Communication'),
    'AMZN': ('Amazon', 'Consumer Disc.'),
    'NVDA': ('NVIDIA', 'Technology'),
    'META': ('Meta', 'Communication'),
    'TSLA': ('Tesla', 'Consumer Disc.'),
    'BRK-B': ('Berkshire', 'Financials'),
    'JPM': ('JPMorgan', 'Financials'),
    'V': ('Visa', 'Financials'),
    'UNH': ('UnitedHealth', 'Healthcare'),
    'JNJ': ('Johnson&Johnson', 'Healthcare'),
    'MA': ('Mastercard', 'Financials'),
    'PG': ('Procter&Gamble', 'Consumer Staples'),
    'HD': ('Home Depot', 'Consumer Disc.'),
    'MRK': ('Merck', 'Healthcare'),
    'ABBV': ('AbbVie', 'Healthcare'),
    'AVGO': ('Broadcom', 'Technology'),
    'PEP': ('PepsiCo', 'Consumer Staples'),
    'KO': ('Coca-Cola', 'Consumer Staples'),
    'COST': ('Costco', 'Consumer Staples'),
    'WMT': ('Walmart', 'Consumer Staples'),
    'MCD': ("McDonald's", 'Consumer Disc.'),
    'CSCO': ('Cisco', 'Technology'),
    'ACN': ('Accenture', 'Technology'),
    'LIN': ('Linde', 'Materials'),
    'TMO': ('Thermo Fisher', 'Healthcare'),
    'ABT': ('Abbott', 'Healthcare'),
    'CRM': ('Salesforce', 'Technology'),
    'AMD': ('AMD', 'Technology'),
    'TXN': ('Texas Inst.', 'Technology'),
    'NEE': ('NextEra', 'Utilities'),
    'PM': ('Philip Morris', 'Consumer Staples'),
    'RTX': ('RTX Corp', 'Industrials'),
    'HON': ('Honeywell', 'Industrials'),
    'LOW': ("Lowe's", 'Consumer Disc.'),
    'SPGI': ('S&P Global', 'Financials'),
    'INTU': ('Intuit', 'Technology'),
    'ISRG': ('Intuitive Surg.', 'Healthcare'),
    'BLK': ('BlackRock', 'Financials'),
    'AMAT': ('Applied Mat.', 'Technology'),
    'GS': ('Goldman Sachs', 'Financials'),
    'NKE': ('Nike', 'Consumer Disc.'),
    'REGN': ('Regeneron', 'Healthcare'),
    'VRTX': ('Vertex Pharma', 'Healthcare'),
    'GE': ('GE Aerospace', 'Industrials'),
    'ORCL': ('Oracle', 'Technology'),
    'NFLX': ('Netflix', 'Communication'),
    'PLTR': ('Palantir', 'Technology'),
    'LLY': ('Eli Lilly', 'Healthcare'),
}


def fetch_ticker_data(ticker, name_sector):
    """단일 종목 데이터 가져오기"""
    try:
        hist = yf.Ticker(ticker).history(period='5d')
        if hist.empty or len(hist) < 2:
            return None
        current = float(hist['Close'].iloc[-1])
        prev = float(hist['Close'].iloc[-2])
        change = ((current / prev) - 1) * 100

        result = {
            'ticker': ticker,
            'price': round(current, 2),
            'change': round(change, 2),
        }

        if isinstance(name_sector, tuple):
            result['name'] = name_sector[0]
            result['sector'] = name_sector[1]
        else:
            result['name'] = name_sector

        return result
    except Exception:
        return None


def fetch_sector_data():
    sectors = []
    stocks = []

    # 1. 섹터 ETF 수집
    print("Fetching 11 sector ETFs...")
    for ticker, name in SECTORS.items():
        data = fetch_ticker_data(ticker, name)
        if data:
            sectors.append(data)
    sectors.sort(key=lambda x: x['change'], reverse=True)
    print(f"  {len(sectors)} sectors fetched")

    # 2. S&P 500 상위 종목 병렬 수집
    print("Fetching top 50 S&P 500 stocks...")
    with ThreadPoolExecutor(max_workers=10) as executor:
        futures = {
            executor.submit(fetch_ticker_data, ticker, info): ticker
            for ticker, info in TOP_STOCKS.items()
        }
        for future in as_completed(futures):
            data = future.result()
            if data:
                stocks.append(data)

    stocks.sort(key=lambda x: x['change'], reverse=True)
    print(f"  {len(stocks)} stocks fetched")

    # 3. Market Breadth 계산
    up_count = sum(1 for s in stocks if s['change'] > 0)
    down_count = sum(1 for s in stocks if s['change'] < 0)
    unchanged = len(stocks) - up_count - down_count
    avg_change = sum(s['change'] for s in stocks) / len(stocks) if stocks else 0

    breadth = {
        'total': len(stocks),
        'up': up_count,
        'down': down_count,
        'unchanged': unchanged,
        'up_ratio': round(up_count / len(stocks) * 100, 1) if stocks else 0,
        'avg_change': round(avg_change, 2),
        'top_gainer': stocks[0] if stocks else None,
        'top_loser': stocks[-1] if stocks else None,
    }

    # 4. 섹터별 종목 그룹핑
    sector_groups = {}
    for s in stocks:
        sector = s.get('sector', 'Other')
        if sector not in sector_groups:
            sector_groups[sector] = []
        sector_groups[sector].append({
            'ticker': s['ticker'],
            'name': s['name'],
            'change': s['change'],
            'price': s['price'],
        })

    # 5. JSON 저장
    output = {
        'timestamp': datetime.now().isoformat(),
        'sectors': sectors,
        'top_stocks': stocks,
        'market_breadth': breadth,
        'sector_groups': sector_groups,
    }

    output_path = os.path.join(os.path.dirname(__file__), '..', 'output', 'sector_heatmap.json')
    os.makedirs(os.path.dirname(output_path), exist_ok=True)
    with open(output_path, 'w') as f:
        json.dump(output, f, indent=2)

    print(f"Saved {len(sectors)} sectors + {len(stocks)} stocks")
    print(f"  Market Breadth: {up_count} up / {down_count} down ({breadth['up_ratio']}% bullish)")


if __name__ == '__main__':
    fetch_sector_data()
