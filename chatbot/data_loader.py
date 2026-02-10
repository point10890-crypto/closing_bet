#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Data Loader - 기존 KR Market 데이터 소스 통합
kr_market/data/kr_ai_analysis.json에서 실제 데이터를 로드하여 챗봇에 제공
"""

import os
import json
import pandas as pd
from pathlib import Path
from typing import List, Dict, Any, Optional
from datetime import datetime
import logging

logger = logging.getLogger(__name__)

# 기본 경로 설정
KR_MARKET_DIR = Path(__file__).parent.parent
DATA_DIR = KR_MARKET_DIR / "data"


def load_kr_ai_analysis() -> Dict[str, Any]:
    """
    kr_market/data/kr_ai_analysis.json에서 AI 분석 데이터 로드
    
    Returns:
        {
            "market_indices": {...},
            "signals": [...],
            "generated_at": "...",
            "signal_date": "..."
        }
    """
    json_path = DATA_DIR / "kr_ai_analysis.json"
    
    if not json_path.exists():
        logger.warning(f"kr_ai_analysis.json not found at {json_path}")
        return {"market_indices": {}, "signals": []}
    
    try:
        with open(json_path, 'r', encoding='utf-8') as f:
            data = json.load(f)
        return data
    except Exception as e:
        logger.error(f"Error loading kr_ai_analysis.json: {e}")
        return {"market_indices": {}, "signals": []}


def load_vcp_stocks() -> List[Dict]:
    """
    kr_ai_analysis.json에서 VCP 상위 종목 로드
    
    Returns:
        [
            {
                "ticker": "005930",
                "name": "삼성전자",
                "score": 93.0,
                "final_score": 88.6,
                "foreign_5d": 100407,
                "inst_5d": 481749,
                "entry_price": 1573.0,
                "current_price": 1573,
                "return_pct": 0.0,
                "gpt_recommendation": {...},
                "gemini_recommendation": {...},
                ...
            },
            ...
        ]
    """
    data = load_kr_ai_analysis()
    signals = data.get("signals", [])
    
    stocks = []
    for signal in signals:
        stock = {
            "ticker": str(signal.get('ticker', '')).zfill(6),
            "name": signal.get('name', 'N/A'),
            "supply_demand_score": float(signal.get('score', 0)),
            "final_score": float(signal.get('final_score', 0)),
            "contraction_ratio": float(signal.get('contraction_ratio', 0)),
            "is_double_buy": signal.get('foreign_5d', 0) > 0 and signal.get('inst_5d', 0) > 0,
            "foreign_5d": int(signal.get('foreign_5d', 0)),
            "inst_5d": int(signal.get('inst_5d', 0)),
            "entry_price": float(signal.get('entry_price', 0)),
            "current_price": float(signal.get('current_price', 0)),
            "return_pct": float(signal.get('return_pct', 0)),
            "market": signal.get('market', 'KOSPI'),
            "gpt_recommendation": signal.get('gpt_recommendation', {}),
            "gemini_recommendation": signal.get('gemini_recommendation', {}),
            "news": signal.get('news', []),
            "fundamentals": signal.get('fundamentals', {})
        }
        stocks.append(stock)
    
    # 점수 기준 정렬
    stocks.sort(key=lambda x: x['supply_demand_score'], reverse=True)
    return stocks


# 하위 호환성을 위해 load_smart_money_picks 함수 유지
def load_smart_money_picks() -> List[Dict]:
    """하위 호환성을 위한 함수 - load_vcp_stocks() 호출"""
    return load_vcp_stocks()


def get_market_gate_scores() -> Dict[str, int]:
    """
    Market Gate 섹터별 점수 조회
    market_gate.py의 run_kr_market_gate() 결과 활용
    
    Returns:
        {"반도체": 85, "2차전지": 72, "자동차": 65, ...}
    """
    try:
        from market_gate import run_kr_market_gate
        result = run_kr_market_gate()
        
        if result and result.sectors:
            return {s.name: s.score for s in result.sectors}
        return {}
        
    except Exception as e:
        logger.warning(f"Market Gate import failed, using fallback: {e}")
        # 폴백: 빈 딕셔너리 반환
        return {}


def get_market_indices() -> Dict[str, Any]:
    """
    kr_ai_analysis.json에서 시장 지수 조회
    
    Returns:
        {
            "kospi": "4309.63 (+2.27%)",
            "kosdaq": "945.57 (+2.17%)",
            "usd_krw": 1350.0,
            "market_gate": "GREEN"
        }
    """
    data = load_kr_ai_analysis()
    indices = data.get("market_indices", {})
    
    kospi_data = indices.get("kospi", {})
    kosdaq_data = indices.get("kosdaq", {})
    
    kospi_val = kospi_data.get("value", 0)
    kospi_pct = kospi_data.get("change_pct", 0)
    kospi_str = f"{kospi_val:,.2f} ({kospi_pct:+.2f}%)" if kospi_val else "N/A"
    
    kosdaq_val = kosdaq_data.get("value", 0)
    kosdaq_pct = kosdaq_data.get("change_pct", 0)
    kosdaq_str = f"{kosdaq_val:,.2f} ({kosdaq_pct:+.2f}%)" if kosdaq_val else "N/A"
    
    # 환율 (FinanceDataReader 사용 - yfinance 대신)
    usd_krw_val = 1350.0  # 기본값
    try:
        import FinanceDataReader as fdr
        from datetime import datetime, timedelta
        today = datetime.now().strftime('%Y-%m-%d')
        week_ago = (datetime.now() - timedelta(days=7)).strftime('%Y-%m-%d')
        usd_krw_df = fdr.DataReader('USD/KRW', week_ago, today)
        if len(usd_krw_df) > 0:
            usd_krw_val = float(usd_krw_df['Close'].iloc[-1])
    except Exception as e:
        logger.warning(f"FinanceDataReader USD/KRW failed: {e}")
        pass
    
    # Market Gate 판단
    if usd_krw_val >= 1450:
        gate = "RED"
    elif usd_krw_val >= 1400:
        gate = "YELLOW"
    else:
        gate = "GREEN"
    
    return {
        "kospi": kospi_str,
        "kosdaq": kosdaq_str,
        "usd_krw": usd_krw_val,
        "market_gate": gate
    }


def get_stock_by_name(name: str) -> Optional[Dict]:
    """종목명으로 검색 (부분 일치)"""
    stocks = load_vcp_stocks()
    for stock in stocks:
        if name in stock.get('name', ''):
            return stock
    return None


def get_stock_by_ticker(ticker: str) -> Optional[Dict]:
    """종목코드로 검색"""
    ticker = str(ticker).zfill(6)
    stocks = load_vcp_stocks()
    for stock in stocks:
        if stock.get('ticker') == ticker:
            return stock
    return None


def fetch_all_data() -> Dict[str, Any]:
    """
    모든 데이터를 통합해서 반환
    KRStockChatbot의 data_fetcher로 사용
    
    Returns:
        {
            "market": {...},
            "vcp_stocks": [...],
            "sector_scores": {...},
            "timestamp": "2026-01-05T21:30:00"
        }
    """
    return {
        "market": get_market_indices(),
        "vcp_stocks": load_vcp_stocks(),
        "sector_scores": get_market_gate_scores(),
        "timestamp": datetime.now().isoformat()
    }


def get_top_vcp_stocks(n: int = 10) -> List[Dict]:
    """상위 N개 VCP 종목 반환"""
    stocks = load_vcp_stocks()
    return stocks[:n]


def get_double_buy_stocks() -> List[Dict]:
    """쌍끌이 종목만 반환 (외인+기관 동시 순매수)"""
    stocks = load_vcp_stocks()
    return [s for s in stocks if s.get('is_double_buy', False)]


def search_stock(query: str) -> Optional[Dict]:
    """
    종목 검색 (이름 또는 코드)
    
    Args:
        query: 종목명 또는 종목코드
        
    Returns:
        종목 정보 딕셔너리 또는 None
    """
    # 숫자로만 구성되어 있으면 티커로 검색
    if query.isdigit():
        return get_stock_by_ticker(query)
    
    # 아니면 이름으로 검색
    return get_stock_by_name(query)
