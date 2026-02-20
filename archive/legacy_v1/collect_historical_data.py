#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
KR Market - Historical Institutional Data Collector
과거 60일 외인/기관 수급 데이터 수집기

네이버 금융에서 일별 외인/기관 순매매 데이터를 수집하여
날짜별로 저장합니다. 이를 통해 장기 백테스트가 가능해집니다.

출력 파일: kr_market/historical_institutional_data.csv
컬럼: ticker, date, foreign_net, inst_net, volume, close_price
"""
import pandas as pd
import numpy as np
import requests
from bs4 import BeautifulSoup
import re
import os
import time
from datetime import datetime, timedelta
from concurrent.futures import ThreadPoolExecutor, as_completed
from tqdm import tqdm
import logging

logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)


class HistoricalInstitutionalCollector:
    """과거 수급 데이터 수집기"""
    
    def __init__(self, data_dir: str = None):
        self.data_dir = data_dir or os.path.dirname(os.path.abspath(__file__))
        self.output_path = os.path.join(self.data_dir, 'historical_institutional_data.csv')
        
        # 세션 설정
        self.session = requests.Session()
        self.session.headers.update({
            'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
            'Accept-Language': 'ko-KR,ko;q=0.9',
        })
        
        self.request_delay = 0.2  # 요청 간격
        
        logger.info("✅ Historical Institutional Data Collector 초기화 완료")
    
    def load_stock_list(self, limit: int = None) -> list:
        """종목 리스트 로드"""
        csv_path = os.path.join(os.path.dirname(self.data_dir), 'korean_stocks_list.csv')
        
        if os.path.exists(csv_path):
            df = pd.read_csv(csv_path)
            df['ticker'] = df['ticker'].astype(str).str.zfill(6)
            tickers = df['ticker'].tolist()
            
            if limit:
                tickers = tickers[:limit]
            
            logger.info(f"📊 {len(tickers)}개 종목 로드됨")
            return tickers
        else:
            logger.error(f"❌ 종목 리스트 없음: {csv_path}")
            return []
    
    def scrape_daily_data(self, ticker: str) -> list:
        """
        단일 종목의 일별 수급 데이터 스크래핑 (최대 60일)
        
        Returns:
            List of dicts with keys: ticker, date, foreign_net, inst_net, volume, close_price
        """
        try:
            url = f"https://finance.naver.com/item/frgn.naver?code={ticker}"
            response = self.session.get(url, timeout=10)
            response.encoding = 'euc-kr'
            
            if response.status_code != 200:
                return []
            
            soup = BeautifulSoup(response.text, 'html.parser')
            
            daily_data = []
            tables = soup.find_all('table', class_='type2')
            
            for table in tables:
                rows = table.find_all('tr')
                
                for row in rows:
                    cells = row.find_all(['td', 'th'])
                    
                    if len(cells) >= 7:
                        try:
                            # 날짜 확인
                            date_cell = cells[0].get_text(strip=True)
                            if not re.match(r'\d{4}\.\d{2}\.\d{2}', date_cell):
                                continue
                            
                            # 데이터 파싱
                            close_price = self._parse_number(cells[1].get_text(strip=True))
                            volume = self._parse_number(cells[4].get_text(strip=True))
                            inst_net = self._parse_signed_number(cells[5].get_text(strip=True))
                            foreign_net = self._parse_signed_number(cells[6].get_text(strip=True))
                            
                            if volume > 0:
                                # 날짜 형식 변환 (2024.12.28 -> 2024-12-28)
                                date_formatted = date_cell.replace('.', '-')
                                
                                daily_data.append({
                                    'ticker': ticker,
                                    'date': date_formatted,
                                    'foreign_net': foreign_net,
                                    'inst_net': inst_net,
                                    'volume': volume,
                                    'close_price': close_price
                                })
                            
                            if len(daily_data) >= 60:
                                break
                                
                        except (IndexError, ValueError):
                            continue
                
                if len(daily_data) >= 60:
                    break
            
            time.sleep(self.request_delay)
            return daily_data
            
        except Exception as e:
            logger.warning(f"⚠️ {ticker} 스크래핑 실패: {e}")
            return []
    
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
    
    def collect_all(self, max_stocks: int = None, max_workers: int = 10) -> pd.DataFrame:
        """
        전체 종목 수급 데이터 수집
        
        Args:
            max_stocks: 최대 종목 수 (테스트용)
            max_workers: 동시 스레드 수
        """
        logger.info("🚀 과거 수급 데이터 수집 시작...")
        
        tickers = self.load_stock_list(limit=max_stocks)
        
        if not tickers:
            return pd.DataFrame()
        
        all_data = []
        success_count = 0
        fail_count = 0
        
        with ThreadPoolExecutor(max_workers=max_workers) as executor:
            futures = {executor.submit(self.scrape_daily_data, t): t 
                      for t in tickers}
            
            for future in tqdm(as_completed(futures), total=len(futures), 
                              desc="수급 데이터 수집"):
                ticker = futures[future]
                try:
                    data = future.result()
                    if data:
                        all_data.extend(data)
                        success_count += 1
                    else:
                        fail_count += 1
                except Exception as e:
                    logger.warning(f"⚠️ {ticker} 처리 실패: {e}")
                    fail_count += 1
        
        # DataFrame 생성
        df = pd.DataFrame(all_data)
        
        if not df.empty:
            # 정렬 및 중복 제거
            df = df.sort_values(['ticker', 'date'])
            df = df.drop_duplicates(subset=['ticker', 'date'])
            
            # 저장
            df.to_csv(self.output_path, index=False, encoding='utf-8-sig')
            
            logger.info(f"\n✅ 수집 완료!")
            logger.info(f"   성공: {success_count}개 종목")
            logger.info(f"   실패: {fail_count}개 종목")
            logger.info(f"   총 레코드: {len(df):,}개")
            logger.info(f"   기간: {df['date'].min()} ~ {df['date'].max()}")
            logger.info(f"   저장: {self.output_path}")
        
        return df
    
    def generate_signals_from_history(self, lookback_days: int = 5) -> pd.DataFrame:
        """
        히스토리 데이터로부터 일별 시그널 생성
        
        각 날짜별로 "그 날 기준 과거 N일" 수급을 계산하여
        시그널(쌍끌이 등)을 판단합니다.
        """
        if not os.path.exists(self.output_path):
            logger.error("❌ 히스토리 데이터가 없습니다. 먼저 collect_all()을 실행하세요.")
            return pd.DataFrame()
        
        logger.info("📊 히스토리 기반 시그널 생성 중...")
        
        df = pd.read_csv(self.output_path)
        df['date'] = pd.to_datetime(df['date'])
        
        # 날짜별 시그널 계산
        signals = []
        unique_dates = df['date'].unique()
        unique_dates = sorted(unique_dates)[lookback_days:]  # lookback 이후 날짜만
        
        for signal_date in tqdm(unique_dates, desc="시그널 생성"):
            # 해당 날짜 기준 과거 N일 데이터
            start_date = signal_date - pd.Timedelta(days=lookback_days)
            
            for ticker in df['ticker'].unique():
                ticker_data = df[(df['ticker'] == ticker) & 
                                (df['date'] > start_date) & 
                                (df['date'] <= signal_date)]
                
                if len(ticker_data) >= lookback_days - 1:
                    foreign_sum = ticker_data['foreign_net'].sum()
                    inst_sum = ticker_data['inst_net'].sum()
                    
                    # 연속 매수일 계산
                    foreign_consecutive = 0
                    for _, row in ticker_data.sort_values('date', ascending=False).iterrows():
                        if row['foreign_net'] > 0:
                            foreign_consecutive += 1
                        else:
                            break
                    
                    # 쌍끌이 판단
                    is_double_buy = (foreign_sum > 0 and inst_sum > 0 and 
                                    foreign_consecutive >= 3)
                    
                    if is_double_buy:
                        signals.append({
                            'ticker': ticker,
                            'signal_date': signal_date,
                            'foreign_sum': foreign_sum,
                            'inst_sum': inst_sum,
                            'consecutive_days': foreign_consecutive,
                            'close_price': ticker_data.iloc[-1]['close_price']
                        })
        
        signals_df = pd.DataFrame(signals)
        
        if not signals_df.empty:
            signals_path = os.path.join(self.data_dir, 'historical_signals.csv')
            signals_df.to_csv(signals_path, index=False, encoding='utf-8-sig')
            logger.info(f"✅ 시그널 저장: {signals_path}")
            logger.info(f"   총 시그널: {len(signals_df)}개")
        
        return signals_df


def main():
    """메인 실행"""
    collector = HistoricalInstitutionalCollector(
        data_dir=os.path.join(os.path.dirname(os.path.abspath(__file__)), 'data')
    )
    
    # 전체 수집 (테스트: 100개 종목만)
    # 전체 2760개 종목 수집 시 max_stocks=None
    df = collector.collect_all(max_stocks=100, max_workers=10)
    
    if not df.empty:
        print("\n" + "=" * 60)
        print("📊 수집된 데이터 샘플")
        print("=" * 60)
        print(df.head(20).to_string())
        
        # 시그널 생성
        print("\n📊 시그널 생성 중...")
        signals = collector.generate_signals_from_history(lookback_days=5)
        
        if not signals.empty:
            print("\n" + "=" * 60)
            print("🎯 생성된 시그널 샘플")
            print("=" * 60)
            print(signals.head(20).to_string())


if __name__ == "__main__":
    main()
