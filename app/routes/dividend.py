# app/routes/dividend.py
"""Dividend Stocks API Routes"""

import traceback
from datetime import datetime
from flask import Blueprint, jsonify, request

dividend_bp = Blueprint('dividend', __name__)


def _safe_float(val, default=0):
    if val is None:
        return default
    try:
        import math
        f = float(val)
        return default if math.isnan(f) else f
    except (ValueError, TypeError):
        return default


@dividend_bp.route('/top')
def get_top_dividends():
    """Top Dividend ETFs & Stocks"""
    try:
        import yfinance as yf

        dividend_tickers = {
            # Dividend ETFs
            'SCHD': {'name': 'Schwab US Dividend', 'type': 'ETF'},
            'VYM': {'name': 'Vanguard High Dividend', 'type': 'ETF'},
            'HDV': {'name': 'iShares Core High Div', 'type': 'ETF'},
            'DVY': {'name': 'iShares Select Dividend', 'type': 'ETF'},
            'DGRO': {'name': 'iShares Dividend Growth', 'type': 'ETF'},
            # Dividend Aristocrats
            'JNJ': {'name': 'Johnson & Johnson', 'type': 'Stock'},
            'PG': {'name': 'Procter & Gamble', 'type': 'Stock'},
            'KO': {'name': 'Coca-Cola', 'type': 'Stock'},
            'PEP': {'name': 'PepsiCo', 'type': 'Stock'},
            'ABBV': {'name': 'AbbVie', 'type': 'Stock'},
            'T': {'name': 'AT&T', 'type': 'Stock'},
            'VZ': {'name': 'Verizon', 'type': 'Stock'},
        }

        result = []
        for ticker, info in dividend_tickers.items():
            try:
                stock = yf.Ticker(ticker)
                fast_info = stock.fast_info
                hist = stock.history(period='5d')

                price = _safe_float(hist['Close'].iloc[-1]) if not hist.empty else 0
                prev = _safe_float(hist['Close'].iloc[-2]) if not hist.empty and len(hist) >= 2 else price
                change_pct = ((price / prev) - 1) * 100 if prev else 0

                # Get dividend yield
                div_yield = 0
                try:
                    div_yield = _safe_float(getattr(fast_info, 'dividend_yield', 0)) * 100
                except Exception:
                    pass

                result.append({
                    'ticker': ticker,
                    'name': info['name'],
                    'type': info['type'],
                    'price': round(price, 2),
                    'change_pct': round(change_pct, 2),
                    'dividend_yield': round(div_yield, 2),
                })
            except Exception as e:
                print(f"Error fetching {ticker}: {e}")

        result.sort(key=lambda x: x['dividend_yield'], reverse=True)

        return jsonify({
            'dividends': result,
            'timestamp': datetime.now().isoformat()
        })
    except Exception as e:
        traceback.print_exc()
        return jsonify({'error': str(e), 'dividends': []}), 500


@dividend_bp.route('/kr-top')
def get_kr_top_dividends():
    """Korean High Dividend Stocks (cached data)"""
    try:
        import os
        import json

        base_dir = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
        data_dir = os.path.join(base_dir, 'data')

        # Read from portfolio data
        portfolio_path = os.path.join(data_dir, 'daily_report.json')
        kr_dividends = []

        if os.path.exists(portfolio_path):
            with open(portfolio_path, 'r', encoding='utf-8') as f:
                report = json.load(f)
            signals = report.get('signals', [])
            for s in signals[:20]:
                kr_dividends.append({
                    'ticker': s.get('ticker', ''),
                    'name': s.get('name', ''),
                    'price': _safe_float(s.get('current_price', 0)),
                    'change_pct': _safe_float(s.get('return_pct', 0)),
                    'score': _safe_float(s.get('score', 0)),
                })

        return jsonify({
            'kr_dividends': kr_dividends,
            'timestamp': datetime.now().isoformat()
        })
    except Exception as e:
        traceback.print_exc()
        return jsonify({'error': str(e), 'kr_dividends': []}), 500
