#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
KR Market - Smart Money Screener
외국인/기관 수급 기반 종목 스크리너

핵심 기능:
1. 네이버 금융에서 수급 데이터 수집
2. 외인/기관 순매매 트렌드 분석
3. 매집 신호 감지 및 점수화
4. Top N 종목 선정
"""
import logging
import pandas as pd
import numpy as np
from datetime import datetime, timedelta
from typing import Dict, List, Optional, Tuple
from dataclasses import asdict
import os
import sys
import time
import requests
from bs4 import BeautifulSoup
import re
from concurrent.futures import ThreadPoolExecutor, as_completed
from tqdm import tqdm

# 현재 디렉토리를 모듈 경로로 추가
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from config import ScreenerConfig, TrendThresholds, BacktestConfig
from models import StockInfo, InstitutionalFlow, TrendAnalysis, Signal

logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)


class SmartMoneyScreener:
    """
    Smart Money Screener - 외인/기관 매집 종목 탐지
    
    분석 항목:
    1. 외국인 수급 (40%): 순매매량, 연속 매수일, 보유 비율 변화
    2. 기관 수급 (30%): 순매매량, 투신/연기금 구분
    3. 기술적 분석 (20%): RSI, 이동평균선 정배열
    4. 펀더멘털 (10%): 시총, 거래량
    """
    
    def __init__(self, data_dir: str = None, config: ScreenerConfig = None):
        self.data_dir = data_dir or os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
        self.config = config or ScreenerConfig()
        self.thresholds = TrendThresholds()
        
        # 네이버 금융 세션
        self.session = requests.Session()
        self.session.headers.update({
            'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
            'Accept-Language': 'ko-KR,ko;q=0.9',
        })
        
        # 캐시
        self._cache = {}
        
        logger.info("✅ Smart Money Screener 초기화 완료")
    
    # ========== VCP 패턴 감지 (Crypto에서 이식) ==========
    
    def detect_vcp_pattern(self, prices_df: pd.DataFrame, 
                          lookback: int = 20,
                          contraction_threshold: float = 0.7) -> Tuple[bool, Dict]:
        """
        VCP (Volatility Contraction Pattern) 감지
        
        코인 VCP 백테스트에서 이식한 로직:
        - ATR(변동성)이 점점 줄어드는 패턴
        - 고가-저가 범위 축소
        - 현재가가 최근 고점 근처
        
        Args:
            prices_df: 가격 데이터 (columns: high, low, close/current_price)
            lookback: 분석 기간 (일)
            contraction_threshold: 축소 비율 임계값 (0.7 = 30% 축소)
            
        Returns:
            (is_vcp, details_dict)
        """
        if len(prices_df) < lookback:
            return False, {}
        
        recent = prices_df.tail(lookback).copy()
        
        # 컬럼명 통일
        price_col = 'current_price' if 'current_price' in recent.columns else 'close'
        high_col = 'high' if 'high' in recent.columns else price_col
        low_col = 'low' if 'low' in recent.columns else price_col
        
        # 1. 전반부/후반부 가격 범위 비교
        first_half = recent.head(lookback // 2)
        second_half = recent.tail(lookback // 2)
        
        range_first = first_half[high_col].max() - first_half[low_col].min()
        range_second = second_half[high_col].max() - second_half[low_col].min()
        
        if range_first == 0:
            return False, {}
        
        contraction_ratio = range_second / range_first
        
        # 2. 현재가 고점 근처 확인 (상승 추세)
        current_price = recent.iloc[-1][price_col]
        recent_high = recent[price_col].max()
        price_from_high = (recent_high - current_price) / recent_high * 100
        price_near_high = current_price >= recent_high * 0.95  # 고점의 95% 이상
        
        # 3. 추가: 트렌드 상승 확인 (20일 전보다 위에 있는지)
        price_start = recent.iloc[0][price_col]
        is_uptrend = current_price > price_start * 0.98  # 시작점 대비 -2% 이내
        
        # VCP 조건: 변동성 축소 + 고점 근처 + 상승 추세
        is_vcp = (contraction_ratio <= contraction_threshold and 
                  price_near_high and 
                  is_uptrend)
        
        return is_vcp, {
            'contraction_ratio': round(contraction_ratio, 3),
            'price_from_high_pct': round(price_from_high, 2),
            'price_near_high': price_near_high,
            'is_uptrend': is_uptrend,
            'recent_high': recent_high,
            'current_price': current_price
        }
    
    def calculate_vcp_score(self, vcp_info: Dict) -> float:
        """VCP 신호 강도 점수 (0-20점)"""
        if not vcp_info:
            return 0.0
        
        score = 0.0
        
        # 축소 비율이 낮을수록 고점수 (0.3이면 만점)
        contraction = vcp_info.get('contraction_ratio', 1.0)
        if contraction <= 0.3:
            score += 10.0
        elif contraction <= 0.5:
            score += 7.0
        elif contraction <= 0.7:
            score += 4.0
        
        # 고점 근처 보너스
        if vcp_info.get('price_near_high', False):
            score += 5.0
        
        # 상승 추세 보너스
        if vcp_info.get('is_uptrend', False):
            score += 5.0
        
        return score
    
    def load_stock_list(self) -> pd.DataFrame:
        """종목 리스트 로드"""
        csv_path = os.path.join(self.data_dir, 'korean_stocks_list.csv')
        
        if os.path.exists(csv_path):
            df = pd.read_csv(csv_path)
            logger.info(f"📊 {len(df)}개 종목 로드됨")
            return df
        else:
            logger.error(f"❌ 종목 리스트 없음: {csv_path}")
            return pd.DataFrame()
    
    def scrape_institutional_data(self, ticker: str) -> Optional[TrendAnalysis]:
        """
        네이버 금융에서 외인/기관 순매매 데이터 스크래핑
        """
        try:
            url = f"https://finance.naver.com/item/frgn.naver?code={ticker}"
            response = self.session.get(url, timeout=10)
            response.encoding = 'euc-kr'
            
            if response.status_code != 200:
                return None
            
            soup = BeautifulSoup(response.text, 'html.parser')
            
            # 일별 데이터 추출
            daily_data = self._extract_daily_data(soup)
            
            if len(daily_data) < 5:
                return None
            
            # 트렌드 분석
            return self._analyze_trend(ticker, daily_data)
            
        except Exception as e:
            logger.warning(f"⚠️ {ticker} 스크래핑 실패: {e}")
            return None
    
    def _extract_daily_data(self, soup: BeautifulSoup) -> List[Dict]:
        """일별 외인/기관 데이터 추출"""
        daily_data = []
        
        tables = soup.find_all('table', class_='type2')
        
        for table in tables:
            rows = table.find_all('tr')
            
            for row in rows:
                cells = row.find_all(['td', 'th'])
                
                if len(cells) >= 7:
                    try:
                        date_cell = cells[0].get_text(strip=True)
                        if not re.match(r'\d{4}\.\d{2}\.\d{2}', date_cell):
                            continue
                        
                        # 종가, 거래량, 기관, 외인
                        close_price = self._parse_number(cells[1].get_text(strip=True))
                        volume = self._parse_number(cells[4].get_text(strip=True))
                        inst_net = self._parse_signed_number(cells[5].get_text(strip=True))
                        foreign_net = self._parse_signed_number(cells[6].get_text(strip=True))
                        
                        if volume > 0:
                            daily_data.append({
                                'date': date_cell,
                                'close': close_price,
                                'volume': volume,
                                'inst_net': inst_net,
                                'foreign_net': foreign_net
                            })
                        
                        if len(daily_data) >= 60:
                            break
                            
                    except (IndexError, ValueError):
                        continue
            
            if len(daily_data) >= 60:
                break
        
        return daily_data
    
    def _parse_number(self, text: str) -> int:
        """숫자 파싱"""
        text = re.sub(r'[,\s]', '', text)
        numbers = re.findall(r'\d+', text)
        return int(numbers[0]) if numbers else 0
    
    def _parse_signed_number(self, text: str) -> int:
        """부호 포함 숫자 파싱"""
        text = re.sub(r'[,\s]', '', text)
        
        if '+' in text or '▲' in text:
            numbers = re.findall(r'\d+', text)
            return int(numbers[0]) if numbers else 0
        elif '-' in text or '▼' in text:
            numbers = re.findall(r'\d+', text)
            return -int(numbers[0]) if numbers else 0
        else:
            numbers = re.findall(r'\d+', text)
            return int(numbers[0]) if numbers else 0
    
    def _analyze_trend(self, ticker: str, daily_data: List[Dict]) -> TrendAnalysis:
        """수급 트렌드 분석"""
        df = pd.DataFrame(daily_data)
        
        # 기간별 순매매 합계
        periods = {
            '60d': df,
            '20d': df.head(20),
            '10d': df.head(10),
            '5d': df.head(5)
        }
        
        foreign_net = {f'{p}': int(data['foreign_net'].sum()) for p, data in periods.items()}
        inst_net = {f'{p}': int(data['inst_net'].sum()) for p, data in periods.items()}
        
        # 거래량 대비 비율
        total_volume_20d = int(periods['20d']['volume'].sum())
        foreign_ratio_20d = (foreign_net['20d'] / total_volume_20d * 100) if total_volume_20d > 0 else 0
        inst_ratio_20d = (inst_net['20d'] / total_volume_20d * 100) if total_volume_20d > 0 else 0
        
        # 연속 매수일 계산
        foreign_consecutive = self._count_consecutive_buy(df['foreign_net'].tolist())
        inst_consecutive = self._count_consecutive_buy(df['inst_net'].tolist())
        
        # 트렌드 판단
        foreign_trend = self._determine_trend(foreign_net['60d'], foreign_net['20d'], 
                                             foreign_ratio_20d, 'foreign')
        inst_trend = self._determine_trend(inst_net['60d'], inst_net['20d'], 
                                          inst_ratio_20d, 'inst')
        
        # 수급 점수 계산
        score = self._calculate_score(foreign_net, inst_net, 
                                      foreign_ratio_20d, inst_ratio_20d,
                                      foreign_consecutive, inst_consecutive)
        
        # 수급 단계
        stage = self._determine_stage(score)
        
        # 쌍끌이 여부
        is_double_buy = (foreign_net['5d'] > 0 and inst_net['5d'] > 0 and
                        foreign_consecutive >= 3 and inst_consecutive >= 2)
        
        return TrendAnalysis(
            ticker=ticker,
            analysis_date=datetime.now().strftime('%Y-%m-%d'),
            foreign_net_60d=foreign_net['60d'],
            foreign_net_20d=foreign_net['20d'],
            foreign_net_10d=foreign_net['10d'],
            foreign_net_5d=foreign_net['5d'],
            inst_net_60d=inst_net['60d'],
            inst_net_20d=inst_net['20d'],
            inst_net_10d=inst_net['10d'],
            inst_net_5d=inst_net['5d'],
            foreign_ratio_20d=round(foreign_ratio_20d, 2),
            inst_ratio_20d=round(inst_ratio_20d, 2),
            foreign_consecutive_buy_days=foreign_consecutive,
            inst_consecutive_buy_days=inst_consecutive,
            foreign_trend=foreign_trend,
            inst_trend=inst_trend,
            supply_demand_score=round(score, 1),
            supply_demand_stage=stage,
            is_double_buy=is_double_buy,
            accumulation_intensity=self._get_intensity(score)
        )
    
    def _count_consecutive_buy(self, net_buys: List[int]) -> int:
        """연속 순매수일 계산"""
        count = 0
        for nb in net_buys:
            if nb > 0:
                count += 1
            else:
                break
        return count
    
    def _determine_trend(self, total_60d: int, total_20d: int, 
                        ratio_20d: float, investor_type: str) -> str:
        """트렌드 판단"""
        if investor_type == 'foreign':
            thresholds = (self.thresholds.foreign_strong_buy, 
                         self.thresholds.foreign_buy,
                         self.thresholds.foreign_sell,
                         self.thresholds.foreign_strong_sell)
        else:
            thresholds = (self.thresholds.inst_strong_buy,
                         self.thresholds.inst_buy,
                         self.thresholds.inst_sell,
                         self.thresholds.inst_strong_sell)
        
        if total_60d > thresholds[0] and ratio_20d > 10:
            return 'strong_buying'
        elif total_60d > thresholds[1] and ratio_20d > 5:
            return 'buying'
        elif total_60d < thresholds[3] and ratio_20d < -10:
            return 'strong_selling'
        elif total_60d < thresholds[2] and ratio_20d < -5:
            return 'selling'
        else:
            return 'neutral'
    
    def _calculate_score(self, foreign_net: Dict, inst_net: Dict,
                        foreign_ratio: float, inst_ratio: float,
                        foreign_consecutive: int, inst_consecutive: int) -> float:
        """
        수급 점수 계산 (0-100)
        
        가중치:
        - 외국인 순매매량: 25점
        - 외국인 연속 매수일: 15점
        - 기관 순매매량: 20점
        - 기관 연속 매수일: 10점
        - 거래량 대비 비율: 20점
        - 모멘텀 (최근 vs 과거): 10점
        """
        score = 50.0  # 기본 점수
        
        # 외국인 순매매량 (25점)
        if foreign_net['60d'] > 0:
            foreign_score = min(foreign_net['60d'] / 10_000_000, 1.0) * 25
            score += foreign_score
        else:
            score -= min(abs(foreign_net['60d']) / 10_000_000, 1.0) * 15
        
        # 외국인 연속 매수일 (15점)
        score += min(foreign_consecutive / 10, 1.0) * 15
        
        # 기관 순매매량 (20점)
        if inst_net['60d'] > 0:
            inst_score = min(inst_net['60d'] / 5_000_000, 1.0) * 20
            score += inst_score
        else:
            score -= min(abs(inst_net['60d']) / 5_000_000, 1.0) * 10
        
        # 기관 연속 매수일 (10점)
        score += min(inst_consecutive / 5, 1.0) * 10
        
        # 거래량 대비 비율 (20점)
        ratio_score = (foreign_ratio + inst_ratio) / 30 * 20
        score += max(-10, min(ratio_score, 20))
        
        # 모멘텀 (10점) - 최근 5일 vs 이전 15일
        recent = foreign_net['5d'] + inst_net['5d']
        prev = (foreign_net['20d'] - foreign_net['5d']) + (inst_net['20d'] - inst_net['5d'])
        
        if prev != 0:
            momentum = (recent * 3 - prev) / abs(prev)
            score += max(-5, min(momentum * 5, 10))
        
        return max(0, min(score, 100))
    
    def _determine_stage(self, score: float) -> str:
        """수급 단계 판단"""
        if score >= 85:
            return "강한매집"
        elif score >= 70:
            return "매집"
        elif score >= 60:
            return "약매집"
        elif score >= 40:
            return "중립"
        elif score >= 30:
            return "약분산"
        elif score >= 15:
            return "분산"
        else:
            return "강한분산"
    
    def _get_intensity(self, score: float) -> str:
        """매집 강도"""
        if score >= 80:
            return "매우강함"
        elif score >= 65:
            return "강함"
        elif score >= 50:
            return "보통"
        elif score >= 35:
            return "약함"
        else:
            return "매도세"
    
    def run_screening(self, max_stocks: int = None, 
                     max_workers: int = 5) -> pd.DataFrame:
        """
        전체 스크리닝 실행
        """
        logger.info("🚀 Smart Money Screening 시작...")
        
        # 종목 로드
        stocks_df = self.load_stock_list()
        if stocks_df.empty:
            return pd.DataFrame()
        
        if max_stocks:
            stocks_df = stocks_df.head(max_stocks)
        
        tickers = stocks_df['ticker'].tolist()
        logger.info(f"📊 {len(tickers)}개 종목 분석 예정")
        
        results = []
        
        # 멀티스레드로 데이터 수집
        with ThreadPoolExecutor(max_workers=max_workers) as executor:
            futures = {executor.submit(self.scrape_institutional_data, t): t 
                      for t in tickers}
            
            for future in tqdm(as_completed(futures), total=len(futures), 
                              desc="수급 분석"):
                ticker = futures[future]
                try:
                    analysis = future.result()
                    if analysis and analysis.supply_demand_score >= 50:
                        results.append(asdict(analysis))
                except Exception as e:
                    logger.warning(f"⚠️ {ticker} 분석 실패: {e}")
        
        # DataFrame 생성 및 정렬
        df = pd.DataFrame(results)
        
        if not df.empty:
            # 종목명 추가
            df = df.merge(stocks_df[['ticker', 'name']], on='ticker', how='left')
            
            # 점수순 정렬
            df = df.sort_values('supply_demand_score', ascending=False)
            
            logger.info(f"✅ 스크리닝 완료: {len(df)}개 종목 발견")
        
        return df.head(self.config.top_n)
    
    def generate_signals(self, screening_df: pd.DataFrame) -> List[Signal]:
        """스크리닝 결과로부터 시그널 생성"""
        signals = []
        
        for _, row in screening_df.iterrows():
            # 시그널 타입 결정
            if row.get('is_double_buy', False):
                signal_type = "DOUBLE_BUY"
            elif row['foreign_consecutive_buy_days'] >= 5:
                signal_type = "FOREIGNER_BUY"
            elif row['inst_consecutive_buy_days'] >= 3:
                signal_type = "INST_SCOOP"
            else:
                signal_type = "FOREIGNER_BUY"
            
            # 등급 결정
            score = row['supply_demand_score']
            if score >= 80:
                grade = "A"
            elif score >= 70:
                grade = "B"
            elif score >= 60:
                grade = "C"
            else:
                grade = "D"
            
            signal = Signal(
                ticker=row['ticker'],
                name=row.get('name', ''),
                signal_type=signal_type,
                signal_time=int(datetime.now().timestamp()),
                score=int(score),
                grade=grade,
                price=0.0,  # 별도 조회 필요
                foreign_net_5d=row['foreign_net_5d'],
                inst_net_5d=row['inst_net_5d'],
                consecutive_days=max(row['foreign_consecutive_buy_days'], 
                                    row['inst_consecutive_buy_days'])
            )
            signals.append(signal)
        
        return signals


def main():
    """테스트 실행"""
    screener = SmartMoneyScreener()
    
    # 상위 50개 종목만 테스트
    results = screener.run_screening(max_stocks=50, max_workers=3)
    
    if not results.empty:
        print("\n" + "="*80)
        print("🏆 Smart Money Top 20")
        print("="*80)
        
        for i, (_, row) in enumerate(results.head(20).iterrows(), 1):
            print(f"{i:2}. {row['ticker']} {row.get('name', '')[:10]:10} | "
                  f"점수: {row['supply_demand_score']:.0f} | "
                  f"외인: {row['foreign_net_5d']:+,} | "
                  f"기관: {row['inst_net_5d']:+,} | "
                  f"연속: {row['foreign_consecutive_buy_days']}일 | "
                  f"{row['supply_demand_stage']}")
        
        # CSV 저장
        output_path = os.path.join(screener.data_dir, 'kr_market', 'smart_money_picks.csv')
        os.makedirs(os.path.dirname(output_path), exist_ok=True)
        results.to_csv(output_path, index=False, encoding='utf-8-sig')
        print(f"\n📁 저장됨: {output_path}")


if __name__ == "__main__":
    main()
