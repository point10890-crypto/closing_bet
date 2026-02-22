# app/routes/stock_analyzer.py
"""종목 분석 (yfinance + Finnhub) — 클라우드 호환, Selenium 불필요

데이터 소스:
  - yfinance: 애널리스트 추천, 목표가, 재무제표, 시세 (KR + US)
  - Finnhub:  추천 트렌드 보조 데이터 (US, 60회/분 무료)

기존 Selenium/Investing.com ProPicks 방식을 완전 대체.
"""

import os
import time
import logging
import pandas as pd
from io import BytesIO
from flask import Blueprint, jsonify, request, send_file
from datetime import datetime

logger = logging.getLogger('stock_analyzer')

stock_analyzer_bp = Blueprint('stock_analyzer', __name__)


def _consensus_label(score: float) -> str:
    """컨센서스 점수 → 한글 라벨 (공용)"""
    if score >= 4.3:
        return '적극 매수'
    elif score >= 3.7:
        return '매수'
    elif score >= 2.7:
        return '중립'
    elif score >= 2.0:
        return '매도'
    return '적극 매도'

# ── 경로 설정 ──
_ROUTES_DIR = os.path.dirname(os.path.abspath(__file__))
_BASE_DIR = os.path.dirname(os.path.dirname(_ROUTES_DIR))
_DATA_DIR = os.path.join(_BASE_DIR, 'data')
TICKER_MAP_PATH = os.path.join(_DATA_DIR, 'ticker_to_yahoo_map.csv')

# ── KR 종목 매핑 (lazy load) ──
_kr_stocks = None


def _load_kr_stocks():
    """ticker_to_yahoo_map.csv 로드 — KR 종목 이름 → yfinance 심볼 매핑"""
    global _kr_stocks
    if _kr_stocks is not None:
        return _kr_stocks

    try:
        df = pd.read_csv(TICKER_MAP_PATH)
        _kr_stocks = []
        for _, row in df.iterrows():
            _kr_stocks.append({
                'ticker': str(row.get('ticker', '')).strip(),
                'yahoo': str(row.get('yahoo_ticker', '')).strip(),
                'name': str(row.get('name', '')).strip(),
                'market': str(row.get('market', '')).strip(),
            })
        logger.info(f"[StockAnalyzer] {len(_kr_stocks)}개 KR 종목 매핑 로드")
    except Exception as e:
        logger.error(f"[StockAnalyzer] 매핑 로드 실패: {e}")
        _kr_stocks = []

    return _kr_stocks


# ── US 인기 종목 (빠른 검색용) ──
_US_POPULAR = [
    ('AAPL', 'Apple'), ('MSFT', 'Microsoft'), ('GOOGL', 'Alphabet'),
    ('AMZN', 'Amazon'), ('NVDA', 'NVIDIA'), ('META', 'Meta Platforms'),
    ('TSLA', 'Tesla'), ('BRK-B', 'Berkshire Hathaway'), ('JPM', 'JPMorgan Chase'),
    ('V', 'Visa'), ('UNH', 'UnitedHealth'), ('MA', 'Mastercard'),
    ('HD', 'Home Depot'), ('PG', 'Procter & Gamble'), ('JNJ', 'Johnson & Johnson'),
    ('COST', 'Costco'), ('ABBV', 'AbbVie'), ('CRM', 'Salesforce'),
    ('MRK', 'Merck'), ('AVGO', 'Broadcom'), ('KO', 'Coca-Cola'),
    ('PEP', 'PepsiCo'), ('TMO', 'Thermo Fisher'), ('AMD', 'AMD'),
    ('NFLX', 'Netflix'), ('ADBE', 'Adobe'), ('DIS', 'Disney'),
    ('INTC', 'Intel'), ('QCOM', 'Qualcomm'), ('CSCO', 'Cisco'),
    ('BA', 'Boeing'), ('GS', 'Goldman Sachs'), ('CAT', 'Caterpillar'),
    ('IBM', 'IBM'), ('GE', 'GE Aerospace'), ('UBER', 'Uber'),
    ('PLTR', 'Palantir'), ('COIN', 'Coinbase'), ('MSTR', 'MicroStrategy'),
    ('ARM', 'ARM Holdings'), ('SMCI', 'Super Micro'), ('MU', 'Micron'),
    ('SNOW', 'Snowflake'), ('PANW', 'Palo Alto Networks'), ('CRWD', 'CrowdStrike'),
    ('SQ', 'Block'), ('SHOP', 'Shopify'), ('ROKU', 'Roku'),
    ('SOFI', 'SoFi'), ('RIVN', 'Rivian'),
]


# ============================================================
# 분석 엔진 (yfinance + Finnhub)
# ============================================================

def _analyze_with_yfinance(yahoo_ticker: str) -> dict:
    """yfinance로 종목 분석 — 추천, 목표가, 재무, 시세"""
    import yfinance as yf

    ticker = yf.Ticker(yahoo_ticker)
    result = {
        'yahoo_ticker': yahoo_ticker,
        'recommendation': None,
        'recommendation_detail': None,
        'price_targets': None,
        'current_price': None,
        'key_stats': None,
        'source': 'yfinance',
    }

    # 1) 기본 정보 (시세, 시총, PER 등)
    try:
        info = ticker.info or {}
        result['current_price'] = info.get('currentPrice') or info.get('regularMarketPrice')
        result['key_stats'] = {
            'name': info.get('shortName') or info.get('longName', ''),
            'sector': info.get('sector', ''),
            'industry': info.get('industry', ''),
            'market_cap': info.get('marketCap'),
            'pe_ratio': info.get('trailingPE'),
            'forward_pe': info.get('forwardPE'),
            'dividend_yield': info.get('dividendYield'),
            'beta': info.get('beta'),
            'fifty_two_week_high': info.get('fiftyTwoWeekHigh'),
            'fifty_two_week_low': info.get('fiftyTwoWeekLow'),
            'revenue': info.get('totalRevenue'),
            'profit_margin': info.get('profitMargins'),
            'currency': info.get('currency', 'KRW' if '.K' in yahoo_ticker else 'USD'),
        }
    except Exception as e:
        logger.warning(f"yfinance info 실패 ({yahoo_ticker}): {e}")

    # 2) 애널리스트 추천 (strongBuy/buy/hold/sell/strongSell)
    try:
        recs = ticker.recommendations
        if recs is not None and len(recs) > 0:
            # 최근 데이터 사용
            latest = recs.iloc[-1] if hasattr(recs, 'iloc') else recs
            detail = {
                'strongBuy': int(latest.get('strongBuy', 0)),
                'buy': int(latest.get('buy', 0)),
                'hold': int(latest.get('hold', 0)),
                'sell': int(latest.get('sell', 0)),
                'strongSell': int(latest.get('strongSell', 0)),
            }
            result['recommendation_detail'] = detail

            # 컨센서스 점수 계산 (5점 만점)
            total = sum(detail.values())
            if total > 0:
                score = (
                    detail['strongBuy'] * 5 +
                    detail['buy'] * 4 +
                    detail['hold'] * 3 +
                    detail['sell'] * 2 +
                    detail['strongSell'] * 1
                ) / total

                result['recommendation'] = _consensus_label(score)
                result['consensus_score'] = round(score, 2)
                result['analyst_count'] = total
    except Exception as e:
        logger.warning(f"yfinance recommendations 실패 ({yahoo_ticker}): {e}")

    # 3) 목표가
    try:
        targets = ticker.analyst_price_targets
        if targets and isinstance(targets, dict):
            result['price_targets'] = {
                'current': targets.get('current'),
                'high': targets.get('high'),
                'low': targets.get('low'),
                'mean': targets.get('mean'),
                'median': targets.get('median'),
            }
            # 현재가 대비 상승 여력
            if result['current_price'] and targets.get('mean'):
                upside = ((targets['mean'] - result['current_price']) / result['current_price']) * 100
                result['upside_potential'] = round(upside, 1)
    except Exception as e:
        logger.warning(f"yfinance price_targets 실패 ({yahoo_ticker}): {e}")

    return result


def _supplement_with_finnhub(ticker_symbol: str, yf_result: dict) -> dict:
    """Finnhub으로 US 종목 추천 데이터 보완 (무료 60회/분)"""
    api_key = os.getenv('FINNHUB_API_KEY', '')
    if not api_key or '.K' in ticker_symbol:
        # Finnhub API 키 없거나 KR 종목이면 스킵
        return yf_result

    try:
        import requests
        url = f'https://finnhub.io/api/v1/stock/recommendation?symbol={ticker_symbol}&token={api_key}'
        resp = requests.get(url, timeout=5)
        if resp.status_code == 200:
            data = resp.json()
            if data and len(data) > 0:
                latest = data[0]
                yf_result['finnhub_supplement'] = {
                    'strongBuy': latest.get('strongBuy', 0),
                    'buy': latest.get('buy', 0),
                    'hold': latest.get('hold', 0),
                    'sell': latest.get('sell', 0),
                    'strongSell': latest.get('strongSell', 0),
                    'period': latest.get('period', ''),
                }
    except Exception as e:
        logger.warning(f"Finnhub 보완 실패 ({ticker_symbol}): {e}")

    return yf_result


# ============================================================
# API Endpoints
# ============================================================

@stock_analyzer_bp.route('/search')
def search_stocks():
    """종목 검색 (KR + US, 이름/티커 부분 매칭, 최대 20건)

    쿼리 파라미터:
      q: 검색어 (종목명 또는 티커)
      market: 'kr', 'us', 'all' (기본: 'all')
    """
    q = request.args.get('q', '').strip().lower()
    market = request.args.get('market', 'all').strip().lower()

    if not q:
        return jsonify([])

    results = []

    # 1) KR 종목 검색
    if market in ('kr', 'all'):
        kr_stocks = _load_kr_stocks()
        for s in kr_stocks:
            name = s['name'].lower()
            ticker = s['ticker'].lower()
            yahoo = s['yahoo'].lower()
            if q in name or q in ticker or q in yahoo:
                results.append({
                    'name': s['name'],
                    'ticker': s['yahoo'],       # yfinance용 심볼
                    'code': s['ticker'],         # 순수 종목코드
                    'market': s['market'],       # KOSPI/KOSDAQ
                    'type': 'KR',
                })
                if len(results) >= 20:
                    break

    # 2) US 종목 검색
    if market in ('us', 'all') and len(results) < 20:
        for ticker, name in _US_POPULAR:
            if q in ticker.lower() or q in name.lower():
                results.append({
                    'name': name,
                    'ticker': ticker,
                    'code': ticker,
                    'market': 'US',
                    'type': 'US',
                })
                if len(results) >= 20:
                    break

    # 3) US 직접 티커 입력 (목록에 없는 종목)
    if len(results) == 0 and q.isalpha() and len(q) <= 5:
        results.append({
            'name': q.upper(),
            'ticker': q.upper(),
            'code': q.upper(),
            'market': 'US',
            'type': 'US_DIRECT',
        })

    return jsonify(results)


@stock_analyzer_bp.route('/analyze', methods=['POST'])
def analyze_stock():
    """종목 분석 — yfinance + Finnhub (Selenium 불필요, 클라우드 호환)

    Request body:
      {
        "ticker": "005930.KS" 또는 "AAPL",
        "name": "삼성전자" (표시용)
      }
    """
    data = request.json or {}
    ticker = data.get('ticker', '').strip()
    name = data.get('name', ticker)

    if not ticker:
        return jsonify({'error': '티커가 없습니다.'}), 400

    try:
        # yfinance 분석
        start = time.time()
        result = _analyze_with_yfinance(ticker)

        # Finnhub 보조 (US 종목만)
        if not ticker.endswith('.KS') and not ticker.endswith('.KQ'):
            result = _supplement_with_finnhub(ticker, result)

        elapsed = round(time.time() - start, 1)
        now = datetime.now().strftime('%Y-%m-%d %H:%M:%S')

        # 응답 구성
        recommendation = result.get('recommendation')
        if not recommendation:
            # 추천 데이터 없으면 기본 정보만 반환
            if result.get('current_price'):
                recommendation = '데이터 없음'
            else:
                return jsonify({
                    'error': f'{name} ({ticker}) — 데이터를 찾을 수 없습니다.',
                    'name': name,
                }), 404

        response = {
            'name': name,
            'ticker': ticker,
            'result': recommendation,
            'date': now,
            'elapsed': elapsed,

            # 상세 데이터
            'consensus_score': result.get('consensus_score'),
            'analyst_count': result.get('analyst_count', 0),
            'recommendation_detail': result.get('recommendation_detail'),
            'price_targets': result.get('price_targets'),
            'current_price': result.get('current_price'),
            'upside_potential': result.get('upside_potential'),
            'key_stats': result.get('key_stats'),
            'finnhub_supplement': result.get('finnhub_supplement'),
            'source': result.get('source', 'yfinance'),
        }

        return jsonify(response)

    except Exception as e:
        logger.exception(f"분석 실패 ({ticker}): {e}")
        return jsonify({
            'error': f'{name} 분석 실패: {str(e)[:200]}',
            'name': name,
        }), 500


@stock_analyzer_bp.route('/export', methods=['POST'])
def export_history():
    """클라이언트 조회 기록을 Excel로 변환하여 다운로드"""
    data = request.json or {}
    records = data.get('records', [])

    if not records:
        return jsonify({'error': '저장할 데이터가 없습니다.'}), 400

    df = pd.DataFrame(records)
    output = BytesIO()
    df.to_excel(output, index=False, engine='openpyxl')
    output.seek(0)

    filename = datetime.now().strftime('%y%m%d') + '_analyst_consensus.xlsx'
    return send_file(
        output,
        mimetype='application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        as_attachment=True,
        download_name=filename
    )
