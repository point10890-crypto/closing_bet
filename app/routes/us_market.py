# app/routes/us_market.py
"""US Market API Routes"""

import os
import json
import math
import traceback
from datetime import datetime
from flask import Blueprint, jsonify, request

us_bp = Blueprint('us', __name__)

# ─── 경로 고정 (__file__ 기반 절대경로) ───
_ROUTES_DIR = os.path.dirname(os.path.abspath(__file__))       # app/routes/
_APP_DIR = os.path.dirname(_ROUTES_DIR)                         # app/
_BASE_DIR = os.path.dirname(_APP_DIR)                           # /c/closing_bet
US_DATA_DIR = os.path.join(_BASE_DIR, 'us_market', 'data')
US_HISTORY_DIR = os.path.join(_BASE_DIR, 'us_market', 'history')
PREVIEW_OUTPUT_DIR = os.path.join(_BASE_DIR, 'us_market_preview', 'output')


def _safe_float(val, default=0):
    """Safely convert to float"""
    if val is None:
        return default
    try:
        f = float(val)
        return default if math.isnan(f) else f
    except (ValueError, TypeError):
        return default


def _load_preview_json(filename):
    """Load a JSON file from the preview output directory"""
    path = os.path.join(PREVIEW_OUTPUT_DIR, filename)
    if os.path.exists(path):
        with open(path, 'r', encoding='utf-8') as f:
            return json.load(f)
    return {}


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


@us_bp.route('/smart-money')
def get_us_smart_money():
    """Smart Money Picks — frontend expects { picks: SmartMoneyStock[], count: number }"""
    try:
        # 1) Try PREVIEW_OUTPUT_DIR first (us_market_preview/output/)
        current_file = os.path.join(PREVIEW_OUTPUT_DIR, 'smart_money_current.json')
        # 2) Fallback to US_DATA_DIR (us_market/data/)
        if not os.path.exists(current_file):
            current_file = os.path.join(US_DATA_DIR, 'smart_money_current.json')

        if os.path.exists(current_file):
            with open(current_file, 'r', encoding='utf-8') as f:
                snapshot = json.load(f)

            picks = []
            for pick in snapshot.get('picks', []):
                price_at_rec = _safe_float(pick.get('price_at_analysis', 0))
                picks.append({
                    'ticker': pick.get('ticker', ''),
                    'name': pick.get('name', ''),
                    'sector': pick.get('sector', ''),
                    'price': _safe_float(pick.get('price_at_analysis', 0)),
                    'price_at_rec': round(price_at_rec, 2),
                    'change_pct': _safe_float(pick.get('target_upside', 0)),
                    'composite_score': _safe_float(pick.get('final_score', 0)),
                    'swing_score': _safe_float(pick.get('quant_score', 0)),
                    'trend_score': _safe_float(pick.get('ai_bonus', 0)),
                    'grade': pick.get('sd_stage', 'N/A'),
                    'recommendation': pick.get('ai_recommendation', ''),
                    'ai_summary': pick.get('ai_summary', ''),
                    'rank': pick.get('rank', 0),
                    'inst_pct': _safe_float(pick.get('inst_pct', 0)),
                    'rsi': _safe_float(pick.get('rsi', 0)),
                })

            return jsonify({
                'picks': picks,
                'count': len(picks),
                'analysis_date': snapshot.get('analysis_date', ''),
                'analysis_timestamp': snapshot.get('analysis_timestamp', ''),
            })

        # Fallback to CSV
        import pandas as pd
        csv_path = os.path.join(PREVIEW_OUTPUT_DIR, 'smart_money_picks_v2.csv')
        if not os.path.exists(csv_path):
            csv_path = os.path.join(US_DATA_DIR, 'smart_money_picks_v2.csv')
        if not os.path.exists(csv_path):
            return jsonify({'error': 'Smart money picks not found. Run screener first.'}), 404

        df = pd.read_csv(csv_path)
        picks = []
        for _, row in df.head(20).iterrows():
            picks.append({
                'ticker': row.get('ticker', ''),
                'name': row.get('name', row.get('ticker', '')),
                'sector': row.get('sector', ''),
                'price': _safe_float(row.get('current_price', 0)),
                'price_at_rec': _safe_float(row.get('current_price', 0)),
                'change_pct': 0,
                'composite_score': _safe_float(row.get('composite_score', 0)),
                'swing_score': 0,
                'trend_score': 0,
                'grade': row.get('grade', 'N/A'),
                'recommendation': '',
                'ai_summary': '',
            })

        return jsonify({'picks': picks, 'count': len(picks)})

    except Exception as e:
        traceback.print_exc()
        return jsonify({'error': str(e)}), 500


@us_bp.route('/smart-money/<ticker>/detail')
def get_smart_money_detail(ticker):
    """Smart Money individual stock detail"""
    try:
        current_file = os.path.join(PREVIEW_OUTPUT_DIR, 'smart_money_current.json')
        if not os.path.exists(current_file):
            current_file = os.path.join(US_DATA_DIR, 'smart_money_current.json')

        if not os.path.exists(current_file):
            return jsonify({'error': 'Smart money data not found'}), 404

        with open(current_file, 'r', encoding='utf-8') as f:
            snapshot = json.load(f)

        pick = None
        for p in snapshot.get('picks', []):
            if p.get('ticker', '').upper() == ticker.upper():
                pick = p
                break

        if not pick:
            return jsonify({'error': f'Ticker {ticker} not found in smart money picks'}), 404

        return jsonify({
            'ticker': pick.get('ticker', ''),
            'name': pick.get('name', ''),
            'sector': pick.get('sector', ''),
            'price': _safe_float(pick.get('price_at_analysis', 0)),
            'change_pct': _safe_float(pick.get('target_upside', 0)),
            'composite_score': _safe_float(pick.get('final_score', 0)),
            'quant_score': _safe_float(pick.get('quant_score', 0)),
            'ai_bonus': _safe_float(pick.get('ai_bonus', 0)),
            'recommendation': pick.get('ai_recommendation', ''),
            'ai_summary': pick.get('ai_summary', ''),
            'sd_stage': pick.get('sd_stage', ''),
            'inst_pct': _safe_float(pick.get('inst_pct', 0)),
            'rsi': _safe_float(pick.get('rsi', 0)),
            'rank': pick.get('rank', 0),
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


# ─── US Market Full Endpoints (Frontend pages) ───
# These serve JSON from us_market_preview/output/ for each dashboard page

@us_bp.route('/market-briefing')
def get_market_briefing():
    """Full market briefing (combines briefing + market_data + smart_money)"""
    try:
        briefing = _load_preview_json('briefing.json')
        if not briefing:
            return jsonify({'error': 'Briefing not available'}), 404
        # Merge market_data if briefing doesn't have it
        if 'market_data' not in briefing:
            md = _load_preview_json('market_data.json')
            if md:
                briefing['market_data'] = md.get('market_data', md)
                briefing.setdefault('vix', md.get('vix'))
                briefing.setdefault('fear_greed', md.get('fear_greed'))
        # Merge smart_money
        if 'smart_money' not in briefing:
            sm = _load_preview_json('top_picks.json')
            if sm:
                briefing['smart_money'] = {'top_picks': sm}
        briefing.setdefault('timestamp', datetime.now().isoformat())
        return jsonify(briefing)
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@us_bp.route('/market-regime')
def get_market_regime():
    """Market regime analysis"""
    try:
        data = _load_preview_json('regime_config.json')
        if not data:
            return jsonify({'error': 'Market regime data not available'}), 404
        return jsonify(data)
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@us_bp.route('/backtest')
def get_backtest():
    """Backtest results"""
    try:
        data = _load_preview_json('backtest_results.json')
        if not data:
            return jsonify({'error': 'Backtest results not available'}), 404
        return jsonify(data)
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@us_bp.route('/decision-signal')
def get_decision_signal():
    """Decision signal (market gate + prediction combined)"""
    try:
        gate = _load_preview_json('market_data.json')
        pred = _load_preview_json('prediction.json')
        regime = _load_preview_json('regime_config.json')
        data = {
            'market_gate': gate,
            'prediction': pred,
            'regime': regime,
            'timestamp': datetime.now().isoformat(),
        }
        return jsonify(data)
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@us_bp.route('/top-picks-report')
def get_top_picks_report():
    """Top 10 stock picks full report"""
    try:
        data = _load_preview_json('final_top10_report.json')
        if not data:
            data = _load_preview_json('top_picks.json')
        if not data:
            return jsonify({'error': 'Top picks report not available'}), 404
        return jsonify(data)
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@us_bp.route('/cumulative-performance')
def get_cumulative_performance():
    """Cumulative performance data"""
    try:
        data = _load_preview_json('performance_report.json')
        if not data:
            return jsonify({'error': 'Performance data not available'}), 404
        return jsonify(data)
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@us_bp.route('/track-record')
def get_track_record():
    """Track record — historical performance of recommendations (same data as cumulative-performance)"""
    try:
        data = _load_preview_json('performance_report.json')
        if not data:
            return jsonify({'error': 'Track record data not available. Run performance_tracker.py first.'}), 404
        return jsonify(data)
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@us_bp.route('/insider-trading')
def get_insider_trading():
    """Insider trading data"""
    try:
        data = _load_preview_json('insider_trading.json')
        if not data:
            return jsonify({'error': 'Insider trading data not available'}), 404
        return jsonify(data)
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@us_bp.route('/options-flow-analysis')
def get_options_flow_analysis():
    """Options flow analysis"""
    try:
        data = _load_preview_json('options_flow.json')
        if not data:
            return jsonify({'error': 'Options flow analysis not available'}), 404
        return jsonify(data)
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@us_bp.route('/news-analysis')
def get_news_analysis():
    """News sentiment analysis"""
    try:
        data = _load_preview_json('news_analysis.json')
        if not data:
            return jsonify({'error': 'News analysis not available'}), 404
        return jsonify(data)
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@us_bp.route('/etf-flow-analysis')
def get_etf_flow_analysis():
    """ETF flow analysis"""
    try:
        data = _load_preview_json('etf_flow_analysis.json')
        if not data:
            return jsonify({'error': 'ETF flow analysis not available'}), 404
        return jsonify(data)
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@us_bp.route('/13f-holdings')
def get_13f_holdings():
    """13F institutional holdings"""
    try:
        # Try JSON first, fall back to CSV
        data = _load_preview_json('sec_filings.json')
        if data:
            return jsonify(data)
        # CSV fallback
        csv_path = os.path.join(PREVIEW_OUTPUT_DIR, 'us_13f_holdings.csv')
        if os.path.exists(csv_path):
            import csv
            holdings = []
            with open(csv_path, 'r', encoding='utf-8') as f:
                reader = csv.DictReader(f)
                for row in reader:
                    holdings.append(row)
            return jsonify({'holdings': holdings, 'count': len(holdings)})
        return jsonify({'error': '13F holdings data not available'}), 404
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@us_bp.route('/earnings-analysis')
def get_earnings_analysis():
    """Earnings analysis"""
    try:
        data = _load_preview_json('earnings_analysis.json')
        if not data:
            return jsonify({'error': 'Earnings analysis not available'}), 404
        return jsonify(data)
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@us_bp.route('/portfolio-risk')
def get_portfolio_risk():
    """Portfolio risk analysis"""
    try:
        data = _load_preview_json('portfolio_risk.json')
        if not data:
            return jsonify({'error': 'Portfolio risk data not available'}), 404
        return jsonify(data)
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@us_bp.route('/prediction-history')
def get_prediction_history():
    """Prediction history"""
    try:
        data = _load_preview_json('prediction_history.json')
        if not data:
            return jsonify({'error': 'Prediction history not available'}), 404
        return jsonify(data)
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@us_bp.route('/data-status')
def get_data_status():
    """Check data file freshness"""
    try:
        files = []
        if os.path.isdir(PREVIEW_OUTPUT_DIR):
            for fname in sorted(os.listdir(PREVIEW_OUTPUT_DIR)):
                fpath = os.path.join(PREVIEW_OUTPUT_DIR, fname)
                if os.path.isfile(fpath):
                    stat = os.stat(fpath)
                    files.append({
                        'name': fname,
                        'size': stat.st_size,
                        'modified': datetime.fromtimestamp(stat.st_mtime).isoformat(),
                    })
        return jsonify({'files': files, 'count': len(files), 'directory': PREVIEW_OUTPUT_DIR})
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@us_bp.route('/sector-rotation')
def get_sector_rotation():
    """Sector rotation analysis"""
    try:
        data = _load_preview_json('sector_rotation.json')
        if not data:
            return jsonify({'error': 'Sector rotation data not available'}), 404
        return jsonify(data)
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@us_bp.route('/risk-alerts')
def get_risk_alerts():
    """Risk alerts"""
    try:
        data = _load_preview_json('risk_alerts.json')
        if not data:
            return jsonify({'error': 'Risk alerts not available'}), 404
        return jsonify(data)
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@us_bp.route('/earnings-impact')
def get_earnings_impact():
    """Earnings impact analysis"""
    try:
        data = _load_preview_json('earnings_impact.json')
        if not data:
            return jsonify({'error': 'Earnings impact data not available'}), 404
        return jsonify(data)
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@us_bp.route('/index-prediction')
def get_index_prediction():
    """Index prediction (ML model)"""
    try:
        data = _load_preview_json('index_prediction.json')
        if not data:
            data = _load_preview_json('prediction.json')
        if not data:
            return jsonify({'error': 'Index prediction not available'}), 404
        return jsonify(data)
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@us_bp.route('/heatmap-data')
def get_heatmap_data():
    """S&P 500 heatmap data"""
    try:
        data = _load_preview_json('sector_heatmap.json')
        if not data:
            return jsonify({'error': 'Heatmap data not available'}), 404
        return jsonify(data)
    except Exception as e:
        return jsonify({'error': str(e)}), 500
