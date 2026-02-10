# app/routes/us_market.py
"""US Market API Routes"""

import os
import json
import traceback
from datetime import datetime
from flask import Blueprint, jsonify, request

us_bp = Blueprint('us', __name__)


def _safe_float(val, default=0):
    """Safely convert to float"""
    if val is None:
        return default
    try:
        import math
        f = float(val)
        return default if math.isnan(f) else f
    except (ValueError, TypeError):
        return default


@us_bp.route('/portfolio')
def get_us_portfolio():
    """US Market Indices - Real-time"""
    try:
        import yfinance as yf

        indices_map = {
            '^DJI': 'Dow Jones',
            '^GSPC': 'S&P 500',
            '^IXIC': 'NASDAQ',
            '^RUT': 'Russell 2000',
            '^VIX': 'VIX',
            'GC=F': 'Gold',
            'CL=F': 'Crude Oil',
            'BTC-USD': 'Bitcoin',
            '^TNX': '10Y Treasury',
            'DX-Y.NYB': 'Dollar Index',
            'KRW=X': 'USD/KRW'
        }

        market_indices = []
        for ticker, name in indices_map.items():
            try:
                stock = yf.Ticker(ticker)
                hist = stock.history(period='5d')
                if not hist.empty and len(hist) >= 2:
                    current_val = float(hist['Close'].iloc[-1])
                    prev_val = float(hist['Close'].iloc[-2])
                    change = current_val - prev_val
                    change_pct = (change / prev_val) * 100
                    market_indices.append({
                        'name': name,
                        'ticker': ticker,
                        'price': round(current_val, 2),
                        'change': round(change, 2),
                        'change_pct': round(change_pct, 2),
                    })
            except Exception as e:
                print(f"Error fetching {ticker}: {e}")

        return jsonify({
            'market_indices': market_indices,
            'timestamp': datetime.now().isoformat()
        })
    except Exception as e:
        traceback.print_exc()
        return jsonify({'error': str(e), 'market_indices': []}), 500


@us_bp.route('/market-gate')
def get_us_market_gate():
    """US Market Gate - SPY based regime detection"""
    try:
        import yfinance as yf

        spy = yf.Ticker('SPY')
        hist = spy.history(period='200d')

        if len(hist) < 200:
            return jsonify({'gate': 'YELLOW', 'score': 50, 'status': 'NEUTRAL'})

        price = float(hist['Close'].iloc[-1])
        ma50 = float(hist['Close'].rolling(50).mean().iloc[-1])
        ma200 = float(hist['Close'].rolling(200).mean().iloc[-1])

        # Calculate RSI
        delta = hist['Close'].diff()
        gain = delta.where(delta > 0, 0).rolling(14).mean()
        loss = (-delta.where(delta < 0, 0)).rolling(14).mean()
        rs = gain / loss
        rsi = float(100 - (100 / (1 + rs)).iloc[-1])

        # Determine gate
        score = 50
        gate = 'YELLOW'
        status = 'NEUTRAL'
        reasons = []

        if price > ma200:
            score += 15
            reasons.append(f'SPY above 200MA (${price:.0f} > ${ma200:.0f})')
        else:
            score -= 15
            reasons.append(f'SPY below 200MA (${price:.0f} < ${ma200:.0f})')

        if ma50 > ma200:
            score += 10
            reasons.append('50MA > 200MA (Golden Cross)')
        else:
            score -= 10
            reasons.append('50MA < 200MA (Death Cross)')

        if price > ma50:
            score += 10
            reasons.append('Price above 50MA')
        else:
            score -= 10

        if rsi > 70:
            score -= 5
            reasons.append(f'RSI overbought ({rsi:.0f})')
        elif rsi < 30:
            score += 5
            reasons.append(f'RSI oversold ({rsi:.0f})')

        if score >= 70:
            gate = 'GREEN'
            status = 'RISK_ON'
        elif score <= 35:
            gate = 'RED'
            status = 'RISK_OFF'

        # Price changes
        change_1d = ((price / float(hist['Close'].iloc[-2])) - 1) * 100 if len(hist) >= 2 else 0
        change_5d = ((price / float(hist['Close'].iloc[-6])) - 1) * 100 if len(hist) >= 6 else 0

        return jsonify({
            'gate': gate,
            'score': score,
            'status': status,
            'reasons': reasons,
            'spy': {
                'price': round(price, 2),
                'ma50': round(ma50, 2),
                'ma200': round(ma200, 2),
                'rsi': round(rsi, 1),
                'change_1d': round(change_1d, 2),
                'change_5d': round(change_5d, 2),
            }
        })
    except Exception as e:
        traceback.print_exc()
        return jsonify({'error': str(e), 'gate': 'YELLOW', 'score': 50}), 500


@us_bp.route('/sector-heatmap')
def get_us_sector_heatmap():
    """US Sector Performance Heatmap"""
    try:
        import yfinance as yf

        sectors = {
            'XLK': 'Technology',
            'XLF': 'Financials',
            'XLV': 'Healthcare',
            'XLE': 'Energy',
            'XLI': 'Industrials',
            'XLY': 'Consumer Disc.',
            'XLP': 'Consumer Staples',
            'XLU': 'Utilities',
            'XLRE': 'Real Estate',
            'XLB': 'Materials',
            'XLC': 'Communication',
        }

        result = []
        for ticker, name in sectors.items():
            try:
                stock = yf.Ticker(ticker)
                hist = stock.history(period='5d')
                if not hist.empty and len(hist) >= 2:
                    current = float(hist['Close'].iloc[-1])
                    prev = float(hist['Close'].iloc[-2])
                    change_pct = ((current / prev) - 1) * 100
                    result.append({
                        'ticker': ticker,
                        'name': name,
                        'price': round(current, 2),
                        'change_pct': round(change_pct, 2),
                    })
            except Exception:
                pass

        result.sort(key=lambda x: x['change_pct'], reverse=True)
        return jsonify({'sectors': result, 'timestamp': datetime.now().isoformat()})
    except Exception as e:
        return jsonify({'error': str(e), 'sectors': []}), 500


@us_bp.route('/stock-chart/<ticker>')
def get_us_stock_chart(ticker):
    """US Stock Chart Data"""
    try:
        import yfinance as yf

        period = request.args.get('period', '6mo')
        stock = yf.Ticker(ticker)
        hist = stock.history(period=period)

        if hist.empty:
            return jsonify({'error': 'No data found'}), 404

        chart_data = []
        for date, row in hist.iterrows():
            chart_data.append({
                'date': date.strftime('%Y-%m-%d'),
                'open': round(row['Open'], 2),
                'high': round(row['High'], 2),
                'low': round(row['Low'], 2),
                'close': round(row['Close'], 2),
                'volume': int(row['Volume']),
            })

        return jsonify({'ticker': ticker, 'data': chart_data, 'period': period})
    except Exception as e:
        return jsonify({'error': str(e)}), 500


# ─── US Market Data Endpoints (from us_market/ scripts) ───

US_DATA_DIR = os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(__file__))), 'us_market', 'data')
US_HISTORY_DIR = os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(__file__))), 'us_market', 'history')


@us_bp.route('/smart-money')
def get_us_smart_money():
    """Smart Money Picks with performance tracking"""
    try:
        import yfinance as yf
        import pandas as pd
        import math

        current_file = os.path.join(US_DATA_DIR, 'smart_money_current.json')

        if os.path.exists(current_file):
            with open(current_file, 'r', encoding='utf-8') as f:
                snapshot = json.load(f)

            tickers = [p['ticker'] for p in snapshot.get('picks', [])]
            current_prices = {}
            for ticker in tickers:
                try:
                    stock = yf.Ticker(ticker)
                    hist = stock.history(period='5d')
                    if not hist.empty:
                        current_prices[ticker] = round(float(hist['Close'].dropna().iloc[-1]), 2)
                except:
                    pass

            picks_with_perf = []
            for pick in snapshot.get('picks', []):
                ticker = pick['ticker']
                price_at_rec = _safe_float(pick.get('price_at_analysis', 0))
                current_price = current_prices.get(ticker, price_at_rec) or price_at_rec
                change_pct = ((current_price / price_at_rec) - 1) * 100 if price_at_rec > 0 else 0

                picks_with_perf.append({
                    **pick,
                    'current_price': round(current_price, 2),
                    'price_at_rec': round(price_at_rec, 2),
                    'change_since_rec': round(change_pct, 2)
                })

            return jsonify({
                'analysis_date': snapshot.get('analysis_date', ''),
                'analysis_timestamp': snapshot.get('analysis_timestamp', ''),
                'top_picks': picks_with_perf,
                'summary': {
                    'total_analyzed': len(picks_with_perf),
                    'avg_score': round(sum(p.get('final_score', 0) for p in picks_with_perf) / max(len(picks_with_perf), 1), 1)
                }
            })

        # Fallback to CSV
        csv_path = os.path.join(US_DATA_DIR, 'smart_money_picks_v2.csv')
        if not os.path.exists(csv_path):
            return jsonify({'error': 'Smart money picks not found. Run screener first.'}), 404

        df = pd.read_csv(csv_path)
        top_picks = []
        for _, row in df.head(20).iterrows():
            top_picks.append({
                'ticker': row['ticker'],
                'name': row.get('name', row['ticker']),
                'final_score': _safe_float(row.get('composite_score', 0)),
                'current_price': _safe_float(row.get('current_price', 0)),
                'grade': row.get('grade', 'N/A'),
            })

        return jsonify({
            'top_picks': top_picks,
            'summary': {'total_analyzed': len(df)}
        })

    except Exception as e:
        traceback.print_exc()
        return jsonify({'error': str(e)}), 500


@us_bp.route('/etf-flows')
def get_us_etf_flows():
    """ETF Fund Flow Analysis"""
    try:
        import pandas as pd

        csv_path = os.path.join(US_DATA_DIR, 'us_etf_flows.csv')
        if not os.path.exists(csv_path):
            return jsonify({'error': 'ETF flows not found. Run analyze_etf_flows.py first.'}), 404

        df = pd.read_csv(csv_path)

        broad_market = df[df['category'] == 'Broad Market']
        broad_score = round(broad_market['flow_score'].mean(), 1) if not broad_market.empty else 50

        top_inflows = df.nlargest(5, 'flow_score').to_dict(orient='records')
        top_outflows = df.nsmallest(5, 'flow_score').to_dict(orient='records')

        ai_analysis_text = ""
        ai_path = os.path.join(US_DATA_DIR, 'etf_flow_analysis.json')
        if os.path.exists(ai_path):
            try:
                with open(ai_path, 'r', encoding='utf-8') as f:
                    ai_data = json.load(f)
                    ai_analysis_text = ai_data.get('ai_analysis', '')
            except:
                pass

        return jsonify({
            'market_sentiment_score': broad_score,
            'top_inflows': top_inflows,
            'top_outflows': top_outflows,
            'all_etfs': df.to_dict(orient='records'),
            'ai_analysis': ai_analysis_text
        })

    except Exception as e:
        traceback.print_exc()
        return jsonify({'error': str(e)}), 500


@us_bp.route('/macro-analysis')
def get_us_macro_analysis():
    """Macro analysis with live indicators + cached AI"""
    try:
        import yfinance as yf
        import time as t

        lang = request.args.get('lang', 'ko')

        if lang == 'en':
            analysis_path = os.path.join(US_DATA_DIR, 'macro_analysis_en.json')
        else:
            analysis_path = os.path.join(US_DATA_DIR, 'macro_analysis.json')

        if not os.path.exists(analysis_path):
            analysis_path = os.path.join(US_DATA_DIR, 'macro_analysis.json')

        ai_analysis = "AI 분석 데이터가 없습니다. macro_analyzer.py를 실행하세요."
        macro_indicators = {}

        if os.path.exists(analysis_path):
            with open(analysis_path, 'r', encoding='utf-8') as f:
                cached = json.load(f)
                ai_analysis = cached.get('ai_analysis', ai_analysis)
                macro_indicators = cached.get('macro_indicators', {})

        # Update key indicators with live data
        live_tickers = {
            'VIX': '^VIX', 'SPY': 'SPY', 'QQQ': 'QQQ',
            'BTC': 'BTC-USD', 'GOLD': 'GC=F', 'USD/KRW': 'KRW=X'
        }

        for name, ticker in live_tickers.items():
            try:
                stock = yf.Ticker(ticker)
                hist = stock.history(period='5d')
                if not hist.empty and len(hist) >= 2:
                    current = float(hist['Close'].iloc[-1])
                    prev = float(hist['Close'].iloc[-2])
                    change_pct = (current - prev) / prev * 100 if prev != 0 else 0
                    macro_indicators[name] = {
                        'value': round(current, 2),
                        'current': round(current, 2),
                        'change_1d': round(change_pct, 2)
                    }
                t.sleep(0.2)
            except:
                pass

        return jsonify({
            'macro_indicators': macro_indicators,
            'ai_analysis': ai_analysis,
            'timestamp': datetime.now().isoformat()
        })

    except Exception as e:
        traceback.print_exc()
        return jsonify({'error': str(e)}), 500


@us_bp.route('/options-flow')
def get_us_options_flow():
    """Options flow data"""
    try:
        flow_path = os.path.join(US_DATA_DIR, 'options_flow.json')
        if not os.path.exists(flow_path):
            return jsonify({'error': 'Options flow data not found.'}), 404

        with open(flow_path, 'r', encoding='utf-8') as f:
            data = json.load(f)
        return jsonify(data)

    except Exception as e:
        return jsonify({'error': str(e)}), 500


@us_bp.route('/ai-summary/<ticker>')
def get_us_ai_summary(ticker):
    """AI-generated summary for a US stock"""
    try:
        lang = request.args.get('lang', 'ko')
        summary_path = os.path.join(US_DATA_DIR, 'ai_summaries.json')

        if not os.path.exists(summary_path):
            return jsonify({'error': 'AI summaries not found.'}), 404

        with open(summary_path, 'r', encoding='utf-8') as f:
            summaries = json.load(f)

        if ticker not in summaries:
            return jsonify({'error': f'Summary not found for {ticker}'}), 404

        summary_data = summaries[ticker]
        if lang == 'en':
            summary = summary_data.get('summary_en', summary_data.get('summary', ''))
        else:
            summary = summary_data.get('summary_ko', summary_data.get('summary', ''))

        return jsonify({
            'ticker': ticker, 'summary': summary, 'lang': lang,
            'updated': summary_data.get('updated', '')
        })

    except Exception as e:
        return jsonify({'error': str(e)}), 500


@us_bp.route('/history-dates')
def get_us_history_dates():
    """Available historical analysis dates"""
    try:
        if not os.path.exists(US_HISTORY_DIR):
            return jsonify({'dates': []})

        dates = []
        for f in os.listdir(US_HISTORY_DIR):
            if f.startswith('picks_') and f.endswith('.json'):
                dates.append(f[6:-5])

        dates.sort(reverse=True)
        return jsonify({'dates': dates, 'count': len(dates)})

    except Exception as e:
        return jsonify({'error': str(e)}), 500


@us_bp.route('/history/<date>')
def get_us_history_by_date(date):
    """Picks from a specific historical date with current performance"""
    try:
        import yfinance as yf
        import math

        history_file = os.path.join(US_HISTORY_DIR, f'picks_{date}.json')
        if not os.path.exists(history_file):
            return jsonify({'error': f'No analysis found for {date}'}), 404

        with open(history_file, 'r', encoding='utf-8') as f:
            snapshot = json.load(f)

        tickers = [p['ticker'] for p in snapshot.get('picks', [])]
        current_prices = {}
        for ticker in tickers:
            try:
                stock = yf.Ticker(ticker)
                hist = stock.history(period='5d')
                if not hist.empty:
                    current_prices[ticker] = round(float(hist['Close'].dropna().iloc[-1]), 2)
            except:
                pass

        picks_with_perf = []
        for pick in snapshot.get('picks', []):
            ticker = pick['ticker']
            price_at_rec = _safe_float(pick.get('price_at_analysis', 0))
            current_price = current_prices.get(ticker, price_at_rec) or price_at_rec
            change_pct = ((current_price / price_at_rec) - 1) * 100 if price_at_rec > 0 else 0

            picks_with_perf.append({
                **pick,
                'current_price': round(current_price, 2),
                'price_at_rec': round(price_at_rec, 2),
                'change_since_rec': round(_safe_float(change_pct), 2)
            })

        changes = [p['change_since_rec'] for p in picks_with_perf if p['price_at_rec'] > 0]
        avg_perf = round(sum(changes) / max(len(changes), 1), 2)

        return jsonify({
            'analysis_date': snapshot.get('analysis_date', date),
            'top_picks': picks_with_perf,
            'summary': {'total': len(picks_with_perf), 'avg_performance': avg_perf}
        })

    except Exception as e:
        traceback.print_exc()
        return jsonify({'error': str(e)}), 500


@us_bp.route('/calendar')
def get_us_calendar():
    """Weekly Economic Calendar"""
    try:
        calendar_path = os.path.join(US_DATA_DIR, 'weekly_calendar.json')
        if not os.path.exists(calendar_path):
            return jsonify({'events': [], 'message': 'Calendar data not available'}), 404

        with open(calendar_path, 'r', encoding='utf-8') as f:
            data = json.load(f)
        return jsonify(data)

    except Exception as e:
        return jsonify({'error': str(e)}), 500


# ─── US Market Night Preview Endpoints ───

PREVIEW_OUTPUT_DIR = os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(__file__))), 'us_market_preview', 'output')


def _load_preview_json(filename):
    """Load a JSON file from the preview output directory"""
    path = os.path.join(PREVIEW_OUTPUT_DIR, filename)
    if os.path.exists(path):
        with open(path, 'r', encoding='utf-8') as f:
            return json.load(f)
    return {}


@us_bp.route('/preview/market-data')
def get_preview_market_data():
    """Preview: Market overview data (indices, bonds, currencies, commodities, Fear&Greed)"""
    try:
        data = _load_preview_json('market_data.json')
        if not data:
            return jsonify({'error': 'Market data not available. Run market_data.py first.'}), 404
        return jsonify(data)
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@us_bp.route('/preview/top-picks')
def get_preview_top_picks():
    """Preview: Smart money top 10 stock picks"""
    try:
        data = _load_preview_json('top_picks.json')
        if not data:
            return jsonify({'error': 'Top picks not available. Run screener.py first.'}), 404
        return jsonify(data)
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@us_bp.route('/preview/prediction')
def get_preview_prediction():
    """Preview: ML direction prediction for SPY"""
    try:
        data = _load_preview_json('prediction.json')
        if not data:
            return jsonify({'error': 'Prediction not available. Run predictor.py first.'}), 404
        return jsonify(data)
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@us_bp.route('/preview/briefing')
def get_preview_briefing():
    """Preview: AI market briefing"""
    try:
        data = _load_preview_json('briefing.json')
        if not data:
            return jsonify({'error': 'Briefing not available. Run briefing.py first.'}), 404
        return jsonify(data)
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@us_bp.route('/preview/sector-heatmap')
def get_preview_sector_heatmap():
    """Preview: Sector ETF heatmap"""
    try:
        data = _load_preview_json('sector_heatmap.json')
        if not data:
            return jsonify({'error': 'Sector heatmap not available. Run sector_heatmap.py first.'}), 404
        return jsonify(data)
    except Exception as e:
        return jsonify({'error': str(e)}), 500
