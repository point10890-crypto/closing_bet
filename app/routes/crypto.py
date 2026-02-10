# app/routes/crypto.py
"""Crypto Market API Routes"""

import traceback
from datetime import datetime
from flask import Blueprint, jsonify, request

crypto_bp = Blueprint('crypto', __name__)


def _safe_float(val, default=0):
    if val is None:
        return default
    try:
        import math
        f = float(val)
        return default if math.isnan(f) else f
    except (ValueError, TypeError):
        return default


@crypto_bp.route('/overview')
def get_crypto_overview():
    """Top Crypto by Market Cap"""
    try:
        import yfinance as yf

        cryptos = {
            'BTC-USD': 'Bitcoin',
            'ETH-USD': 'Ethereum',
            'BNB-USD': 'BNB',
            'SOL-USD': 'Solana',
            'XRP-USD': 'XRP',
            'ADA-USD': 'Cardano',
            'DOGE-USD': 'Dogecoin',
            'AVAX-USD': 'Avalanche',
            'DOT-USD': 'Polkadot',
            'MATIC-USD': 'Polygon',
            'LINK-USD': 'Chainlink',
            'UNI-USD': 'Uniswap',
        }

        result = []
        for ticker, name in cryptos.items():
            try:
                coin = yf.Ticker(ticker)
                hist = coin.history(period='5d')
                if not hist.empty and len(hist) >= 2:
                    price = _safe_float(hist['Close'].iloc[-1])
                    prev = _safe_float(hist['Close'].iloc[-2])
                    change = price - prev
                    change_pct = (change / prev) * 100 if prev else 0
                    vol_24h = _safe_float(hist['Volume'].iloc[-1])
                    result.append({
                        'name': name,
                        'ticker': ticker.replace('-USD', ''),
                        'price': round(price, 2),
                        'change': round(change, 2),
                        'change_pct': round(change_pct, 2),
                        'volume_24h': int(vol_24h),
                    })
            except Exception as e:
                print(f"Error fetching {ticker}: {e}")

        return jsonify({
            'cryptos': result,
            'timestamp': datetime.now().isoformat()
        })
    except Exception as e:
        traceback.print_exc()
        return jsonify({'error': str(e), 'cryptos': []}), 500


@crypto_bp.route('/dominance')
def get_crypto_dominance():
    """BTC Dominance & Market Sentiment"""
    try:
        import yfinance as yf

        btc = yf.Ticker('BTC-USD')
        eth = yf.Ticker('ETH-USD')
        btc_hist = btc.history(period='30d')
        eth_hist = eth.history(period='30d')

        if btc_hist.empty:
            return jsonify({'error': 'No BTC data'}), 500

        btc_price = _safe_float(btc_hist['Close'].iloc[-1])
        eth_price = _safe_float(eth_hist['Close'].iloc[-1]) if not eth_hist.empty else 0

        # BTC 30d performance
        btc_30d_start = _safe_float(btc_hist['Close'].iloc[0])
        btc_30d_change = ((btc_price / btc_30d_start) - 1) * 100 if btc_30d_start else 0

        # Simple RSI for BTC
        delta = btc_hist['Close'].diff()
        gain = delta.where(delta > 0, 0).rolling(14).mean()
        loss = (-delta.where(delta < 0, 0)).rolling(14).mean()
        rs = gain / loss
        rsi = _safe_float(100 - (100 / (1 + rs)).iloc[-1], 50)

        # Sentiment based on RSI
        if rsi > 70:
            sentiment = 'EXTREME_GREED'
        elif rsi > 60:
            sentiment = 'GREED'
        elif rsi > 40:
            sentiment = 'NEUTRAL'
        elif rsi > 30:
            sentiment = 'FEAR'
        else:
            sentiment = 'EXTREME_FEAR'

        return jsonify({
            'btc_price': round(btc_price, 2),
            'eth_price': round(eth_price, 2),
            'btc_rsi': round(rsi, 1),
            'btc_30d_change': round(btc_30d_change, 2),
            'sentiment': sentiment,
            'timestamp': datetime.now().isoformat()
        })
    except Exception as e:
        traceback.print_exc()
        return jsonify({'error': str(e), 'sentiment': 'NEUTRAL'}), 500


@crypto_bp.route('/chart/<ticker>')
def get_crypto_chart(ticker):
    """Crypto Price Chart Data"""
    try:
        import yfinance as yf

        period = request.args.get('period', '3mo')
        symbol = f"{ticker.upper()}-USD"
        coin = yf.Ticker(symbol)
        hist = coin.history(period=period)

        if hist.empty:
            return jsonify({'error': f'No data for {ticker}'}), 404

        chart_data = []
        for date, row in hist.iterrows():
            chart_data.append({
                'date': date.strftime('%Y-%m-%d'),
                'open': round(_safe_float(row['Open']), 2),
                'high': round(_safe_float(row['High']), 2),
                'low': round(_safe_float(row['Low']), 2),
                'close': round(_safe_float(row['Close']), 2),
                'volume': int(_safe_float(row['Volume'])),
            })

        return jsonify({'ticker': ticker.upper(), 'data': chart_data, 'period': period})
    except Exception as e:
        return jsonify({'error': str(e)}), 500
