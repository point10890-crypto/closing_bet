"""
KR VCP AI Analyzer
GPT-4 + Gemini를 활용한 VCP 종목 AI 분석
"""
import os
import json

from datetime import datetime
from typing import Dict, List, Optional
from dotenv import load_dotenv
import yfinance as yf

load_dotenv()

OPENAI_API_KEY = os.getenv('OPENAI_API_KEY')
GOOGLE_API_KEY = os.getenv('GOOGLE_API_KEY') or os.getenv('GEMINI_API_KEY')
PERPLEXITY_API_KEY = os.getenv('PERPLEXITY_API_KEY')

# API 상태 추적 (Rate Limit 관리)
API_STATUS = {
    'gemini': {'available': True, 'last_error': None},
    'openai': {'available': True, 'last_error': None},
    'perplexity': {'available': True, 'last_error': None}
}


def fetch_market_indices() -> Dict:
    """KOSPI, KOSDAQ 지수 조회 (FinanceDataReader 사용)"""
    indices = {
        'kospi': {'value': 0, 'change_pct': 0},
        'kosdaq': {'value': 0, 'change_pct': 0}
    }
    
    try:
        import FinanceDataReader as fdr
        from datetime import datetime, timedelta
        
        today = datetime.now()
        start_date = (today - timedelta(days=7)).strftime('%Y-%m-%d')
        end_date = today.strftime('%Y-%m-%d')
        
        # Mapping: KOSPI='KS11', KOSDAQ='KQ11'
        mapping = {'kospi': 'KS11', 'kosdaq': 'KQ11'}
        
        for name, ticker in mapping.items():
            try:
                df = fdr.DataReader(ticker, start_date, end_date)
                if not df.empty and len(df) >= 2:
                    current = df['Close'].iloc[-1]
                    prev = df['Close'].iloc[-2]
                    change_pct = ((current - prev) / prev) * 100
                    
                    indices[name] = {
                        'value': round(float(current), 2),
                        'change_pct': round(change_pct, 2)
                    }
            except Exception as inner_e:
                print(f"Failed to fetch {name} index: {inner_e}")
                
    except Exception as e:
        print(f"Market indices fetch error: {e}")
    
    return indices


def fetch_current_price(ticker: str) -> int:
    """FinanceDataReader를 통한 실시간 현재가 조회"""
    try:
        import FinanceDataReader as fdr
        from datetime import datetime, timedelta
        
        # FinanceDataReader는 자동으로 Naver Finance 등을 크롤링하여 실시간/종가를 가져옴
        # 종목코드가 숫자면 한국 주식으로 인식
        
        # 최근 5일치 데이터 조회 (휴장일 고려)
        today = datetime.now()
        start = (today - timedelta(days=5)).strftime("%Y-%m-%d")
        end = today.strftime("%Y-%m-%d")
        
        df = fdr.DataReader(ticker, start)
        
        if not df.empty:
             return int(df['Close'].iloc[-1])
        
        # pykrx 폴백 (FDR 실패시)
        from pykrx import stock
        today_str = today.strftime("%Y%m%d")
        df_krx = stock.get_market_ohlcv(today_str, today_str, ticker)
        if not df_krx.empty:
            return int(df_krx['종가'].iloc[-1])

    except Exception as e:
        print(f"Current price fetch error for {ticker}: {e}")
        return 0





def fetch_fundamentals(ticker: str, name: str) -> Dict:
    """pykrx를 통한 주요 재무지표(PER, PBR, ROE, 시총) 조회"""
    fundamentals = {
        'per': 'N/A',
        'pbr': 'N/A',
        'roe': 'N/A',
        'eps': 'N/A',
        'bps': 'N/A',
        'div_yield': 'N/A',
        'marcap': 'N/A'
    }
    
    try:
        from pykrx import stock
        from datetime import datetime, timedelta
        end_date = datetime.now().strftime("%Y%m%d")
        start_date = (datetime.now() - timedelta(days=7)).strftime("%Y%m%d")
        
        # 1. 시가총액 정보
        df_cap = stock.get_market_cap(start_date, end_date, ticker)
        if not df_cap.empty:
            last_cap = df_cap.iloc[-1]
            fundamentals['marcap'] = f"{last_cap['시가총액'] // 100000000:,.0f}억원"
            
        # 2. 투자지표 (PER, PBR, EPS, BPS, DIV)
        df_fund = stock.get_market_fundamental(start_date, end_date, ticker)
        if not df_fund.empty:
            last_fund = df_fund.iloc[-1]
            fundamentals['per'] = str(last_fund['PER']) if last_fund['PER'] != 0 else 'N/A'
            fundamentals['pbr'] = str(last_fund['PBR']) if last_fund['PBR'] != 0 else 'N/A'
            fundamentals['eps'] = f"{int(last_fund['EPS']):,}원" if last_fund['EPS'] != 0 else 'N/A'
            fundamentals['bps'] = f"{int(last_fund['BPS']):,}원" if last_fund['BPS'] != 0 else 'N/A'
            fundamentals['div_yield'] = f"{last_fund['DIV']:.2f}%" if last_fund['DIV'] != 0 else '0.00%'
            
            # ROE 계산 (PBR / PER * 100) - 대략적인 수치
            if fundamentals['per'] != 'N/A' and fundamentals['pbr'] != 'N/A':
                per = float(fundamentals['per'])
                pbr = float(fundamentals['pbr'])
                if per != 0:
                    roe = (pbr / per) * 100
                    fundamentals['roe'] = f"{roe:.2f}%"
                
    except Exception as e:
        print(f"Fundamentals fetch error for {ticker}: {e}")
        
    return fundamentals


def analyze_with_gpt(signal_data: Dict, market_indices: Dict, news: List[Dict]) -> Dict:
    """OpenAI gpt-4o flagship model analysis with rate limit handling"""
    global API_STATUS

    if not OPENAI_API_KEY:
        return {'action': 'N/A', 'confidence': 0, 'reason': 'API 키 없음', 'source': 'none'}

    if not API_STATUS['openai']['available']:
        return {'action': 'HOLD', 'confidence': 50, 'reason': f"OpenAI 일시 중단: {API_STATUS['openai']['last_error']}", 'source': 'skipped'}

    try:
        import openai
        client = openai.OpenAI(api_key=OPENAI_API_KEY)
        
        # 뉴스 요약
        # 뉴스 요약 (제목 + 내용)
        news_text = "\n".join([f"- 제목: {n['title']}\n  요약: {n.get('summary', '내용 없음')}" for n in news[:3]]) if news else "최근 뉴스 없음"
        
        prompt = f"""당신은 한국 주식시장 전문 애널리스트입니다. 아래 데이터를 기반으로 매수/관망/매도 추천을 해주세요.

## 분석 시 핵심 가이드라인
1. **뉴스 신뢰**: 제공된 뉴스는 Gemini 3.0이 검증한 최신 뉴스입니다. 적극적으로 참고하세요.
2. **호재 반영**: 실적 개선, 대규모 수주, 신사업 진출 등의 구체적인 호재가 있다면, 수급이 다소 부족('강한 수급' 기준 미달)하더라도 '매수' 관점을 유지하세요.
3. **종합 판단**: VCP 기술적 지표와 뉴스 모멘텀을 50:50 비중으로 고려하여 판단하세요. 수급은 보조 지표로 활용하세요.

## 종목 기본 정보
- 티커: {signal_data.get('ticker')}
- 종목명: {signal_data.get('name')}
- VCP Score: {signal_data.get('score')}
- 수축비율 (낮을수록 좋음): {signal_data.get('contraction_ratio')}
- 외국인 5일 순매수: {signal_data.get('foreign_5d'):,}주
- 기관 5일 순매수: {signal_data.get('inst_5d'):,}주
- 진입가: ₩{signal_data.get('entry_price'):,}
- 현재가: ₩{signal_data.get('current_price', 0):,} (수익률: {signal_data.get('return_pct', 0):+.2f}%)

## 재무지표 (KRX 공식 데이터)
- 시가총액: {signal_data.get('fundamentals', {}).get('marcap', 'N/A')}
- PER: {signal_data.get('fundamentals', {}).get('per', 'N/A')}
- PBR: {signal_data.get('fundamentals', {}).get('pbr', 'N/A')}
- ROE: {signal_data.get('fundamentals', {}).get('roe', 'N/A')}
- 배당수익률: {signal_data.get('fundamentals', {}).get('div_yield', 'N/A')}

## 시장 현황
- KOSPI: {market_indices['kospi']['value']} ({market_indices['kospi']['change_pct']:+.2f}%)
- KOSDAQ: {market_indices['kosdaq']['value']} ({market_indices['kosdaq']['change_pct']:+.2f}%)

## 수집된 뉴스 (Gemini Grounding)
{news_text}

## 분석 참고
- 뉴스 '요약' 내용을 꼼꼼히 읽고, 해당 이슈가 기업 실적이나 주가에 미칠 구체적인 영향을 분석하세요.

## 응답 형식 (JSON)
{{"action": "BUY/HOLD/SELL", "confidence": 0-100, "reason": "한줄 이유"}}

JSON만 응답하세요:"""

        response = client.chat.completions.create(
            model="gpt-5.2",
            messages=[{"role": "user", "content": prompt}],
            temperature=0.3,
            max_completion_tokens=200,
            response_format={"type": "json_object"}
        )
        
        result_text = response.choices[0].message.content.strip()
        result = json.loads(result_text)
        API_STATUS['openai']['available'] = True  # 성공 시 상태 복구
        return {
            'action': result.get('action', 'HOLD'),
            'confidence': result.get('confidence', 50),
            'reason': result.get('reason', ''),
            'source': 'openai'
        }

    except Exception as e:
        error_msg = str(e).lower()
        print(f"GPT analysis error: {e}")

        # Rate Limit 또는 Quota 초과 감지
        if 'rate' in error_msg or 'limit' in error_msg or 'quota' in error_msg or '429' in error_msg:
            API_STATUS['openai']['available'] = False
            API_STATUS['openai']['last_error'] = 'Rate Limit/Quota 초과'
            print("[WARN] OpenAI Rate Limit - 임시 비활성화")

    return {'action': 'HOLD', 'confidence': 50, 'reason': '분석 실패', 'source': 'openai_error'}


def analyze_with_gemini(signal_data: Dict, market_indices: Dict, news: List[Dict]) -> Dict:
    """Google Gemini 3.0 Pro flagship model analysis with rate limit handling"""
    global API_STATUS

    if not GOOGLE_API_KEY:
        return {
            'recommendation': {'action': 'N/A', 'confidence': 0, 'reason': 'API 키 없음'},
            'grounding_news': [],
            'source': 'none'
        }

    if not API_STATUS['gemini']['available']:
        return {
            'recommendation': {'action': 'HOLD', 'confidence': 50, 'reason': f"Gemini 일시 중단: {API_STATUS['gemini']['last_error']}"},
            'grounding_news': [],
            'source': 'skipped'
        }
    
    try:
        from google import genai
        client = genai.Client(api_key=GOOGLE_API_KEY)
        model_id = 'gemini-3-flash-preview'
        
        prompt = f"""당신은 한국 주식시장 전문 애널리스트입니다. **구글 실시간 검색**을 적극 활용하여 최신 정보를 수집하고 매수/관망/매도 추천을 해주세요.
 
## 분석 시 핵심 가이드라인
1. **Google Search 필수**: {signal_data.get('name')}({signal_data.get('ticker')})의 가장 최신 뉴스(실적, 공시, 수급, 업황)를 반드시 검색하세요.
2. **뉴스 리스트 작성**: 검색을 통해 찾은 핵심 뉴스 3~5개를 제목, **핵심 내용 요약(1~2문장)**, 정확한 출처(URL)와 함께 응답에 포함하세요.
3. **종합 판단**: 검색된 최신 뉴스, 현재 수급(외국인/기관), VCP Score를 종합하여 최종 의견을 제시하세요.
 
## 제공 수급 데이터
- VCP Score: {signal_data.get('score')}
- 수축비율: {signal_data.get('contraction_ratio')}
- 외국인 5일 순매수: {signal_data.get('foreign_5d'):,}주
- 기관 5일 순매수: {signal_data.get('inst_5d'):,}주
- 진입가: ₩{signal_data.get('entry_price'):,}
- 현재가: ₩{signal_data.get('current_price', 0):,} (수익률: {signal_data.get('return_pct', 0):+.2f}%)
- 재무(PER/PBR 등): {signal_data.get('fundamentals')}
 
## 응답 형식 (JSON)
반드시 아래 JSON 형식으로만 응답하세요. 다른 설명은 포함하지 마세요.
{{
  "recommendation": {{
      "action": "BUY/HOLD/SELL",
      "confidence": 0-100,
      "reason": "한줄 핵심 근거"
  }},
  "news_found": [
      {{ "title": "뉴스 제목1", "summary": "뉴스 핵심 내용 1~2문장 요약", "url": "뉴스 URL1" }},
      {{ "title": "뉴스 제목2", "summary": "뉴스 핵심 내용 1~2문장 요약", "url": "뉴스 URL2" }}
  ]
}}"""

        response = client.models.generate_content(
            model=model_id,
            contents=prompt,
            config={
                'tools': [{'google_search': {}}],
                'temperature': 0.1, 
                'response_mime_type': 'application/json'
            }
        )
        
        result_text = response.text.strip()
        
        # JSON 파싱
        import json
        try:
            result = json.loads(result_text)
            news_list = result.get('news_found', [])
            
            return {
                'recommendation': result.get('recommendation', {'action': 'HOLD', 'confidence': 50, 'reason': '분석 실패'}),
                'grounding_news': news_list
            }
        except json.JSONDecodeError:
            # 가끔 마크다운 코드블럭이 포함될 수 있음
            import re
            json_match = re.search(r'\{.*\}', result_text, re.DOTALL)
            if json_match:
                result = json.loads(json_match.group())
                return {
                    'recommendation': result.get('recommendation', {'action': 'HOLD', 'confidence': 50, 'reason': '분석 실패'}),
                    'grounding_news': result.get('news_found', [])
                }
            return {
                'recommendation': {'action': 'HOLD', 'confidence': 50, 'reason': 'JSON 파싱 실패'},
                'grounding_news': [],
                'source': 'gemini_parse_error'
            }

    except Exception as e:
        error_msg = str(e).lower()
        print(f"Gemini analysis error: {e}")

        # Rate Limit 또는 Quota 초과 감지
        if 'rate' in error_msg or 'limit' in error_msg or 'quota' in error_msg or '429' in error_msg or 'resource' in error_msg:
            API_STATUS['gemini']['available'] = False
            API_STATUS['gemini']['last_error'] = 'Rate Limit/Quota 초과'
            print("[WARN] Gemini Rate Limit - 임시 비활성화")

    return {
        'recommendation': {'action': 'HOLD', 'confidence': 50, 'reason': '분석 실패'},
        'grounding_news': [],
        'source': 'gemini_error'
    }


def _get_fallback_recommendation(signal_data: Dict) -> Dict:
    """API 모두 실패 시 기본 추천 (키워드 기반)"""
    score = signal_data.get('score', 0)
    foreign_5d = signal_data.get('foreign_5d', 0)
    inst_5d = signal_data.get('inst_5d', 0)

    # 간단한 수급 기반 판단
    if isinstance(score, (int, float)) and score >= 70 and foreign_5d > 0:
        action = 'BUY'
        confidence = 60
        reason = f"VCP Score {score}, 외국인 순매수 {foreign_5d:,}주 - 기술적 관점 긍정"
    elif foreign_5d < 0 and inst_5d < 0:
        action = 'SELL'
        confidence = 55
        reason = "외국인/기관 동반 순매도 - 수급 부정적"
    else:
        action = 'HOLD'
        confidence = 50
        reason = "API 분석 불가 - 수급 데이터 기반 중립"

    return {'action': action, 'confidence': confidence, 'reason': reason, 'source': 'fallback'}


def analyze_single_ticker(ticker: str, name: str) -> Dict:
    """한 종목에 대한 심층 AI 분석 수행 (3중 폴백: Gemini -> OpenAI -> Fallback)"""
    # 1. 시장 지수 조회
    market_indices = fetch_market_indices()

    # 2. 뉴스 및 재무 데이터 수집
    fundamentals = fetch_fundamentals(ticker, name)

    # 임시 신호 데이터 생성
    signal_data = {
        'ticker': ticker,
        'name': name,
        'score': 'N/A',
        'contraction_ratio': 'N/A',
        'foreign_5d': 0,
        'inst_5d': 0,
        'entry_price': 0,
        'current_price': 0,
        'return_pct': 0.0,
        'fundamentals': fundamentals
    }

    # 3. 실시간 현재가 및 수익률 조회
    current_price = fetch_current_price(ticker)
    if current_price > 0 and signal_data.get('entry_price', 0) > 0:
        entry = signal_data['entry_price']
        ret = ((current_price - entry) / entry) * 100
        signal_data['current_price'] = current_price
        signal_data['return_pct'] = round(ret, 2)
    elif current_price > 0:
        signal_data['current_price'] = current_price

    # 4. AI 분석 (3중 폴백 시스템)
    gemini_res = {'recommendation': {}, 'grounding_news': []}
    gpt_rec = {}
    grounding_news = []
    analysis_source = 'none'

    # 4-1. Gemini 시도
    if API_STATUS['gemini']['available']:
        gemini_res = analyze_with_gemini(signal_data, market_indices, [])
        grounding_news = gemini_res.get('grounding_news', [])
        if gemini_res.get('source') not in ['gemini_error', 'skipped', 'none']:
            analysis_source = 'gemini'

    # 4-2. OpenAI 시도 (Gemini 뉴스 전달)
    if API_STATUS['openai']['available']:
        gpt_rec = analyze_with_gpt(signal_data, market_indices, grounding_news)
        if gpt_rec.get('source') == 'openai':
            analysis_source = 'gemini+openai' if analysis_source == 'gemini' else 'openai'

    # 4-3. 모두 실패 시 Fallback
    if not gemini_res.get('recommendation') and not gpt_rec:
        gpt_rec = _get_fallback_recommendation(signal_data)
        gemini_res['recommendation'] = _get_fallback_recommendation(signal_data)
        analysis_source = 'fallback'

    # 최소한 하나의 추천이 있도록 보장
    if not gpt_rec:
        gpt_rec = _get_fallback_recommendation(signal_data)
    if not gemini_res.get('recommendation'):
        gemini_res['recommendation'] = _get_fallback_recommendation(signal_data)

    return {
        **signal_data,
        'market_indices': market_indices,
        'news': grounding_news,
        'gpt_recommendation': gpt_rec,
        'gemini_recommendation': gemini_res.get('recommendation', {}),
        'analysis_source': analysis_source,
        'generated_at': datetime.now().isoformat()
    }


def generate_ai_recommendations(vcp_signals: List[Dict]) -> Dict:
    """VCP 시그널에 대한 AI 추천 생성 (3중 폴백 시스템)"""
    global API_STATUS

    # 1. 시장 지수 조회
    market_indices = fetch_market_indices()

    # 2. 각 종목별 분석
    analyzed_signals = []
    api_errors = {'gemini': 0, 'openai': 0}

    for idx, signal in enumerate(vcp_signals[:10]):  # Top 10만 분석
        ticker = signal.get('ticker', '')
        name = signal.get('name', '')

        print(f"[{idx+1}/10] Analyzing {name} ({ticker})...")

        # 재무 데이터 수집
        fundamentals = fetch_fundamentals(ticker, name)

        # 시그널 데이터에 재무정보 추가
        signal_with_fund = {
            **signal,
            'fundamentals': fundamentals
        }

        # 실시간 현재가 및 수익률 조회
        current_price = fetch_current_price(ticker) or 0
        if current_price > 0 and signal_with_fund.get('entry_price', 0) > 0:
            entry = signal_with_fund['entry_price']
            ret = ((current_price - entry) / entry) * 100
            signal_with_fund['current_price'] = current_price
            signal_with_fund['return_pct'] = round(ret, 2)
        elif current_price > 0:
            signal_with_fund['current_price'] = current_price

        # AI 분석 (3중 폴백)
        gemini_res = {'recommendation': {}, 'grounding_news': []}
        gpt_rec = {}
        grounding_news = []
        analysis_source = 'none'

        # Gemini 시도
        if API_STATUS['gemini']['available']:
            gemini_res = analyze_with_gemini(signal_with_fund, market_indices, [])
            grounding_news = gemini_res.get('grounding_news', [])
            if gemini_res.get('source') in ['gemini_error', 'skipped']:
                api_errors['gemini'] += 1
            else:
                analysis_source = 'gemini'

        # OpenAI 시도
        if API_STATUS['openai']['available']:
            gpt_rec = analyze_with_gpt(signal_with_fund, market_indices, grounding_news)
            if gpt_rec.get('source') in ['openai_error', 'skipped']:
                api_errors['openai'] += 1
            elif gpt_rec.get('source') == 'openai':
                analysis_source = 'gemini+openai' if analysis_source == 'gemini' else 'openai'

        # 모두 실패 시 Fallback
        if not gemini_res.get('recommendation') or 'error' in str(gemini_res.get('source', '')):
            gemini_res['recommendation'] = _get_fallback_recommendation(signal_with_fund)
        if not gpt_rec or 'error' in str(gpt_rec.get('source', '')):
            gpt_rec = _get_fallback_recommendation(signal_with_fund)

        if analysis_source == 'none':
            analysis_source = 'fallback'

        analyzed_signals.append({
            **signal_with_fund,
            'news': grounding_news,
            'gpt_recommendation': gpt_rec,
            'gemini_recommendation': gemini_res.get('recommendation', {}),
            'analysis_source': analysis_source
        })

        # Rate limit 방지 딜레이
        import time
        time.sleep(0.5)

    # API 상태 요약
    api_status_summary = {
        'gemini': 'active' if API_STATUS['gemini']['available'] else 'rate_limited',
        'openai': 'active' if API_STATUS['openai']['available'] else 'rate_limited',
        'errors': api_errors
    }

    return {
        'market_indices': market_indices,
        'signals': analyzed_signals,
        'api_status': api_status_summary,
        'generated_at': datetime.now().isoformat(),
        'signal_date': datetime.now().strftime('%Y-%m-%d')
    }


if __name__ == '__main__':
    # 테스트
    test_signal = {
        'ticker': '005930',
        'name': '삼성전자',
        'score': 65,
        'contraction_ratio': 0.55,
        'foreign_5d': 150000,
        'inst_5d': 80000,
        'entry_price': 55000
    }
    
    result = generate_ai_recommendations([test_signal])
    print(json.dumps(result, ensure_ascii=False, indent=2))
