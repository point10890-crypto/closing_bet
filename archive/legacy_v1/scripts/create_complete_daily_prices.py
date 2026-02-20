#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
전체 Daily Prices 데이터 생성 스크립트
2024년 1월부터 현재까지의 모든 일별 가격 데이터를 네이버에서 수집
"""

import os
import pandas as pd
import numpy as np
import requests
import time
import logging
from datetime import datetime, timedelta
from typing import Dict, List, Optional
from tqdm import tqdm
import json
import sys

# Windows 환경에서 콘솔 출력 인코딩 강제 설정 (Subprocess Crash 방지)
if sys.platform.startswith('win'):
    sys.stdout.reconfigure(encoding='utf-8')
    sys.stderr.reconfigure(encoding='utf-8')

# 로깅 설정
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

class CompleteDailyPricesCreator:
    def __init__(self):
        # DATA_DIR 환경 변수 사용
        self.data_dir = os.getenv('DATA_DIR', '.')
        self.output_dir = self.data_dir
        
        # 디렉토리 생성
        os.makedirs(self.output_dir, exist_ok=True)
        
        # 세션 설정
        self.session = requests.Session()
        self.session.headers.update({
            'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
        })
        
        # 시작 날짜 (2024년 1월 1일)
        self.start_date = datetime(2024, 1, 1)
        self.end_date = datetime.now()
        
        # 오늘 날짜
        self.today = datetime.now().strftime('%Y-%m-%d')
    
    def get_stock_info(self) -> pd.DataFrame:
        """주식 정보 로드"""
        try:
            stock_info_path = os.path.join(self.data_dir, 'korean_stocks_list.csv')
            if os.path.exists(stock_info_path):
                df = pd.read_csv(stock_info_path, dtype={'ticker': str})
                logger.info(f"✅ 주식 정보 로드: {len(df)}개 종목")
                return df
            else:
                logger.error("❌ korean_stocks_list.csv 파일이 없습니다.")
                return pd.DataFrame()
        except Exception as e:
            logger.error(f"❌ 주식 정보 로드 실패: {e}")
            return pd.DataFrame()
    
    def get_naver_daily_data(self, ticker: str, start_date: str, end_date: str) -> List[Dict]:
        """네이버에서 일별 가격 데이터 수집"""
        try:
            # 네이버 금융 API URL
            url = f"https://api.finance.naver.com/siseJson.naver"
            
            params = {
                'symbol': ticker,
                'requestType': '1',
                'startTime': start_date.replace('-', ''),
                'endTime': end_date.replace('-', ''),
                'timeframe': 'day'
            }
            
            response = self.session.get(url, params=params, timeout=10)
            response.raise_for_status()
            
            # 응답 데이터 파싱
            data_text = response.text.strip()
            if not data_text or data_text == '[]':
                return []
            
            # JSON 파싱 시도
            try:
                data = json.loads(data_text)
            except json.JSONDecodeError:
                # 텍스트 파싱
                lines = data_text.split('\n')
                data = []
                for line in lines[1:]:  # 첫 번째 줄은 헤더
                    if line.strip() and line.strip() != ']':
                        # 대괄호 제거하고 파싱
                        line = line.strip().rstrip(',').strip('[]')
                        if line:
                            parts = line.split(',')
                            if len(parts) >= 6:
                                try:
                                    date = parts[0].strip('"')
                                    open_price = float(parts[1]) if parts[1] != 'null' else 0
                                    high_price = float(parts[2]) if parts[2] != 'null' else 0
                                    low_price = float(parts[3]) if parts[3] != 'null' else 0
                                    close_price = float(parts[4]) if parts[4] != 'null' else 0
                                    volume = int(parts[5]) if parts[5] != 'null' else 0
                                    
                                    data.append({
                                        'date': date,
                                        'open_price': open_price,
                                        'high_price': high_price,
                                        'low_price': low_price,
                                        'close_price': close_price,
                                        'volume': volume
                                    })
                                except (ValueError, IndexError):
                                    continue
            
            return data
            
        except Exception as e:
            logger.debug(f"⚠️ {ticker} 데이터 수집 실패: {e}")
            return []
    
    def calculate_price_change_rate(self, current_price: float, prev_price: float) -> float:
        """가격 변화율 계산"""
        if prev_price == 0:
            return 0.0
        return ((current_price - prev_price) / prev_price) * 100
    
    def create_daily_prices_data(self) -> pd.DataFrame:
        """전체 일별 가격 데이터 생성"""
        logger.info("🚀 전체 일별 가격 데이터 생성 시작...")
        
        # 1. 주식 정보 로드
        stock_info = self.get_stock_info()
        if stock_info.empty:
            logger.error("❌ 주식 정보가 없어서 중단합니다.")
            return pd.DataFrame()
        
        # 2. 전체 데이터 수집
        all_data = []
        failed_tickers = []
        
        for idx, row in tqdm(stock_info.iterrows(), desc="전체 일별 데이터 수집", total=len(stock_info)):
            ticker = row['ticker']
            name = row['name']
            
            try:
                # 네이버에서 데이터 수집
                start_date_str = self.start_date.strftime('%Y-%m-%d')
                end_date_str = self.end_date.strftime('%Y-%m-%d')
                
                daily_data = self.get_naver_daily_data(ticker, start_date_str, end_date_str)
                
                if daily_data:
                    # 데이터 변환
                    for i, day_data in enumerate(daily_data):
                        # 이전 날짜 가격 (변화율 계산용)
                        prev_price = 0
                        if i > 0:
                            prev_price = daily_data[i-1]['close_price']
                        
                        # 변화율 계산
                        price_change_rate = self.calculate_price_change_rate(
                            day_data['close_price'], prev_price
                        )
                        
                        # 데이터 행 생성 (네이버 최적화 형식)
                        data_row = {
                            'ticker': ticker,
                            'date': day_data['date'],
                            'name': name,
                            'current_price': day_data['close_price'],
                            'change': day_data['close_price'] - prev_price if prev_price > 0 else 0,
                            'change_rate': price_change_rate,
                            'high': day_data['high_price'],
                            'low': day_data['low_price'],
                            'open': day_data['open_price'],
                            'volume': day_data['volume'],
                            'update_time': datetime.now().strftime('%Y-%m-%d %H:%M:%S')
                        }
                        
                        all_data.append(data_row)
                    
                    logger.debug(f"✅ {ticker} ({name}): {len(daily_data)}일 데이터 수집 완료")
                else:
                    failed_tickers.append(ticker)
                    logger.debug(f"⚠️ {ticker} ({name}): 데이터 없음")
                
                # 요청 간격 조절
                time.sleep(0.1)
                
                # 요청 간격 조절
                time.sleep(0.05)
                
            except Exception as e:
                logger.warning(f"⚠️ {ticker} ({name}) 처리 실패: {e}")
                failed_tickers.append(ticker)
                continue
        
        # 3. DataFrame 생성
        if all_data:
            df = pd.DataFrame(all_data)
            
            # 날짜 정렬
            df['date'] = pd.to_datetime(df['date'])
            df = df.sort_values(['ticker', 'date']).reset_index(drop=True)
            
            logger.info(f"✅ 전체 일별 가격 데이터 생성 완료: {len(df)}개 레코드")
            logger.info(f"📊 성공: {len(stock_info) - len(failed_tickers)}개 종목")
            logger.info(f"📊 실패: {len(failed_tickers)}개 종목")
            
            if failed_tickers:
                logger.warning(f"⚠️ 실패한 종목들: {failed_tickers[:10]}...")
            
            return df
        else:
            logger.error("❌ 수집된 데이터가 없습니다.")
            return pd.DataFrame()
    
    def save_daily_prices(self, df: pd.DataFrame) -> bool:
        """일별 가격 데이터 저장"""
        try:
            # 현재 폴더에 저장
            output_path = os.path.join(self.output_dir, 'daily_prices.csv')
            df.to_csv(output_path, index=False, encoding='utf-8-sig')
            
            logger.info(f"✅ 일별 가격 데이터 저장 완료:")
            logger.info(f"   📁 저장 위치: {output_path}")
            
            # 통계 정보 출력
            self.print_statistics(df)
            
            return True
            
        except Exception as e:
            logger.error(f"❌ 일별 가격 데이터 저장 실패: {e}")
            return False
    
    def print_statistics(self, df: pd.DataFrame):
        """통계 정보 출력"""
        logger.info("📊 일별 가격 데이터 통계:")
        logger.info(f"   총 레코드 수: {len(df):,}개")
        logger.info(f"   종목 수: {df['ticker'].nunique()}개")
        logger.info(f"   기간: {df['date'].min()} ~ {df['date'].max()}")
        logger.info(f"   평균 종가: {df['current_price'].mean():,.0f}원")
        logger.info(f"   평균 거래량: {df['volume'].mean():,.0f}주")
    
    def load_existing_data(self) -> pd.DataFrame:
        """기존 데이터 로드"""
        try:
            file_path = os.path.join(self.output_dir, 'daily_prices.csv')
            if os.path.exists(file_path):
                logger.info(f"📂 기존 데이터 로드 중: {file_path}")
                df = pd.read_csv(file_path, dtype={'ticker': str})
                df['date'] = pd.to_datetime(df['date'])
                return df
            return pd.DataFrame()
        except Exception as e:
            logger.error(f"❌ 기존 데이터 로드 실패: {e}")
            return pd.DataFrame()

    def get_latest_dates(self, df: pd.DataFrame) -> Dict[str, datetime]:
        """각 종목별 마지막 데이터 날짜 확인"""
        if df.empty:
            return {}
        
        latest_dates = df.groupby('ticker')['date'].max().to_dict()
        return latest_dates

    def run(self) -> bool:
        """전체 실행 (증분 업데이트 지원)"""
        logger.info("🚀 전체 일별 가격 데이터 생성 시작...")
        
        try:
            # 1. 기존 데이터 로드
            existing_df = self.load_existing_data()
            latest_dates = self.get_latest_dates(existing_df)
            
            # 2. 주식 정보 로드
            stock_info = self.get_stock_info()
            if stock_info.empty:
                logger.error("❌ 주식 정보가 없어서 중단합니다.")
                return False
            
            # 3. 데이터 수집 (증분)
            new_data = []
            failed_tickers = []
            
            # 오늘 날짜 및 마감 시간 확인
            now = datetime.now()
            today = now.replace(hour=0, minute=0, second=0, microsecond=0)
            
            # 장 마감 시간 (15:30)
            market_close_time = now.replace(hour=15, minute=30, second=0, microsecond=0)
            
            # 마감 시간 전이면 어제까지만 수집
            if now < market_close_time:
                target_end_date = today - timedelta(days=1)
                logger.info(f"🕒 현재 시간({now.strftime('%H:%M')})은 장 마감(15:30) 전입니다.")
                logger.info(f"📅 수집 목표일: {target_end_date.strftime('%Y-%m-%d')} (어제)까지")
            else:
                target_end_date = today
                logger.info(f"🕒 현재 시간({now.strftime('%H:%M')})은 장 마감(15:30) 후입니다.")
                logger.info(f"📅 수집 목표일: {target_end_date.strftime('%Y-%m-%d')} (오늘)까지")

            for idx, row in tqdm(stock_info.iterrows(), desc="일별 데이터 수집", total=len(stock_info)):
                ticker = row['ticker']
                name = row['name']
                
                # 시작 날짜 결정
                if ticker in latest_dates:
                    last_date = latest_dates[ticker]
                    start_date = last_date + timedelta(days=1)
                else:
                    start_date = self.start_date
                
                # 시작 날짜가 목표 종료일보다 미래면 스킵 (이미 최신)
                if start_date > target_end_date:
                    continue
                    
                try:
                    start_date_str = start_date.strftime('%Y-%m-%d')
                    end_date_str = self.end_date.strftime('%Y-%m-%d')
                    
                    daily_data = self.get_naver_daily_data(ticker, start_date_str, end_date_str)
                    
                    if daily_data:
                        for i, day_data in enumerate(daily_data):
                            # 이전 가격 (기존 데이터에서 가져오거나 현재 데이터에서 계산)
                            prev_price = 0
                            # 로직 단순화: 네이버 데이터 자체에 전일비가 없으므로 계산 필요하지만
                            # 여기서는 단순히 수집된 데이터만 처리
                            
                            price_change_rate = 0 # 임시
                            
                            data_row = {
                                'ticker': ticker,
                                'date': day_data['date'],
                                'name': name,
                                'current_price': day_data['close_price'],
                                'change': 0, # 계산 생략
                                'change_rate': 0, # 계산 생략
                                'high': day_data['high_price'],
                                'low': day_data['low_price'],
                                'open': day_data['open_price'],
                                'volume': day_data['volume'],
                                'update_time': datetime.now().strftime('%Y-%m-%d %H:%M:%S')
                            }
                            new_data.append(data_row)
                        
                        # logger.debug(f"✅ {ticker} 업데이트: {len(daily_data)}일 추가")
                    else:
                        # 데이터가 없는 경우 (휴장일 등)
                        pass
                    
                    time.sleep(0.05) # 부하 조절
                    
                except Exception as e:
                    logger.warning(f"⚠️ {ticker} 처리 실패: {e}")
                    failed_tickers.append(ticker)
            
            # 4. 데이터 병합 및 저장
            if new_data:
                new_df = pd.DataFrame(new_data)
                new_df['date'] = pd.to_datetime(new_df['date'])
                
                if not existing_df.empty:
                    final_df = pd.concat([existing_df, new_df]).drop_duplicates(subset=['ticker', 'date'], keep='last')
                else:
                    final_df = new_df
                
                # 정렬
                final_df = final_df.sort_values(['ticker', 'date']).reset_index(drop=True)
                
                self.save_daily_prices(final_df)
                logger.info(f"🎉 업데이트 완료: {len(new_data)}개 레코드 추가됨")
            else:
                logger.info("✨ 모든 데이터가 최신입니다.")
                if not existing_df.empty:
                    self.save_daily_prices(existing_df) # 통계 출력용
            
            return True
                
        except Exception as e:
            logger.error(f"❌ 전체 데이터 생성 중 오류: {e}")
            return False

def main():
    """메인 실행 함수"""
    creator = CompleteDailyPricesCreator()
    success = creator.run()
    
    if success:
        print("\n🎉 전체 일별 가격 데이터 생성이 완료되었습니다!")
        print("📁 파일 위치: ./daily_prices.csv")
    else:
        print("\n❌ 전체 일별 가격 데이터 생성에 실패했습니다.")

if __name__ == "__main__":
    main() 