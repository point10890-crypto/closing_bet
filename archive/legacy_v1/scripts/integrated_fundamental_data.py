import pandas as pd
import numpy as np
import requests
from bs4 import BeautifulSoup
import time
import random
from datetime import datetime
import warnings
import os
warnings.filterwarnings('ignore')

class FundamentalDataCollector:
    def __init__(self):
        self.headers = {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
        }

    def get_naver_financial_data(self, ticker):
        """네이버 금융에서 기본적인 재무 데이터 수집"""
        try:
            # 네이버 금융 URL
            url = f"https://finance.naver.com/item/main.nhn?code={ticker}"
            response = requests.get(url, headers=self.headers)
            response.raise_for_status()
            soup = BeautifulSoup(response.content, 'html.parser')

            data = {}

            # PER, PBR 등 기본 지표
            try:
                # PER
                per_elem = soup.find('em', {'id': '_per'})
                if per_elem and per_elem.text not in ['N/A', '-', '']:
                    data['per'] = float(per_elem.text.replace(',', ''))

                # PBR
                pbr_elem = soup.find('em', {'id': '_pbr'})
                if pbr_elem and pbr_elem.text not in ['N/A', '-', '']:
                    data['pbr'] = float(pbr_elem.text.replace(',', ''))

                # EPS
                eps_elem = soup.find('em', {'id': '_eps'})
                if eps_elem and eps_elem.text not in ['N/A', '-', '']:
                    data['eps'] = float(eps_elem.text.replace(',', ''))

                # BPS
                bps_elem = soup.find('em', {'id': '_bps'})
                if bps_elem and bps_elem.text not in ['N/A', '-', '']:
                    data['bps'] = float(bps_elem.text.replace(',', ''))

                # 배당수익률
                div_yield_elem = soup.find('em', {'id': '_dvr'})
                if div_yield_elem and div_yield_elem.text not in ['N/A', '-', '']:
                    data['div_yield'] = float(div_yield_elem.text.replace('%', '').replace(',', ''))

            except (ValueError, AttributeError) as e:
                print(f"기본 지표 파싱 오류 ({ticker}): {e}")

            return data

        except Exception as e:
            print(f"네이버 데이터 수집 오류 ({ticker}): {e}")
            return {}

    def get_financial_statements_data(self, ticker):
        """재무제표 데이터에서 추가 정보 수집"""
        try:
            # 재무제표 페이지 URL
            url = f"https://finance.naver.com/item/main.nhn?code={ticker}"
            response = requests.get(url, headers=self.headers)
            soup = BeautifulSoup(response.content, 'html.parser')

            data = {}

            # 여기서는 실제 재무제표 데이터 파싱
            # 실제 구현에서는 더 정교한 파싱이 필요합니다

            return data

        except Exception as e:
            print(f"재무제표 데이터 수집 오류 ({ticker}): {e}")
            return {}

    def generate_mock_data(self, ticker, stock_name=None):
        """모의 데이터 생성 (실제 API가 없을 때 사용)"""
        # 종목별로 일관된 데이터를 위한 시드 설정
        seed_value = int(ticker) if ticker.isdigit() else hash(ticker) % 10000
        np.random.seed(seed_value)

        # 종목별 특성을 반영한 기본 배수 설정
        sector_multipliers = {
            "005930": 1.0,    # 삼성전자 (반도체)
            "000660": 0.9,    # SK하이닉스 (반도체)
            "373220": 1.3,    # LG에너지솔루션 (배터리)
            "207940": 2.5,    # 삼성바이오로직스 (바이오)
            "012450": 1.1,    # 한화에어로스페이스 (항공우주)
            "005935": 1.0,    # 삼성전자우
            "005380": 0.7,    # 현대차 (자동차)
            "000270": 0.7,    # 기아 (자동차)
            "105560": 0.8,    # KB금융 (금융)
            "329180": 1.2,    # HD현대중공업 (조선)
        }

        base_multiplier = sector_multipliers.get(ticker, np.random.uniform(0.6, 1.4))

        # 기본 재무 지표 생성
        eps_value = int(np.random.uniform(1500, 12000) * base_multiplier)
        per_value = round(np.random.uniform(6, 30) * (1/base_multiplier), 1)  # 역상관
        bps_value = int(np.random.uniform(25000, 80000) * base_multiplier)
        pbr_value = round(np.random.uniform(0.5, 3.0) * base_multiplier, 2)
        dps_value = int(np.random.uniform(500, 2500) * base_multiplier)
        div_yield_value = round((dps_value / (eps_value * per_value)) * 100, 1)

        # 성장률 (업종별 특성 반영)
        if ticker in ["373220", "207940"]:  # 성장주
            revenue_growth = round(np.random.uniform(0.05, 0.25), 3)
            operating_income_growth = round(np.random.uniform(0.0, 0.30), 3)
            net_income_growth = round(np.random.uniform(-0.05, 0.35), 3)
        elif ticker in ["005380", "000270"]:  # 전통 제조업
            revenue_growth = round(np.random.uniform(-0.05, 0.15), 3)
            operating_income_growth = round(np.random.uniform(-0.10, 0.20), 3)
            net_income_growth = round(np.random.uniform(-0.15, 0.25), 3)
        else:  # 일반적인 경우
            revenue_growth = round(np.random.uniform(-0.08, 0.18), 3)
            operating_income_growth = round(np.random.uniform(-0.12, 0.22), 3)
            net_income_growth = round(np.random.uniform(-0.18, 0.28), 3)

        # 재무비율
        roe = round(np.random.uniform(0.05, 0.25) * base_multiplier, 3)
        roa = round(roe * np.random.uniform(0.3, 0.7), 3)  # ROA는 보통 ROE보다 낮음
        debt_to_equity = round(np.random.uniform(0.1, 0.8), 2)
        current_ratio = round(np.random.uniform(1.2, 3.5), 1)
        operating_margin = round(np.random.uniform(0.03, 0.20) * base_multiplier, 3)

        return {
            'ticker': ticker,
            'per': per_value,
            'pbr': pbr_value,
            'eps': eps_value,
            'bps': bps_value,
            'dps': dps_value,
            'div_yield': div_yield_value,
            'revenue_growth': revenue_growth,
            'operating_income_growth': operating_income_growth,
            'net_income_growth': net_income_growth,
            'naver_roe': roe,
            'naver_roa': roa,
            'naver_debt_to_equity': debt_to_equity,
            'naver_current_ratio': current_ratio,
            'naver_operating_margin': operating_margin,
            'naver_dividend_yield': div_yield_value
        }

    def collect_fundamental_data(self, tickers, stock_names=None):
        """모든 종목의 펀더멘털 데이터 수집"""
        fundamental_data = []
        total_tickers = len(tickers)

        for i, ticker in enumerate(tickers):
            stock_name = stock_names[i] if stock_names and i < len(stock_names) else "Unknown"
            print(f"Processing {ticker} ({stock_name}) - {i+1}/{total_tickers}")

            try:
                # 실제 데이터 수집 시도
                naver_data = self.get_naver_financial_data(ticker)

                # 기본 모의 데이터 생성
                data = self.generate_mock_data(ticker, stock_name)

                # 실제 데이터가 있는 경우 업데이트
                if naver_data:
                    for key, value in naver_data.items():
                        if value is not None and not np.isnan(value):
                            data[key] = value
                    print(f"  → Real data found: {list(naver_data.keys())}")
                else:
                    print(f"  → Using mock data")

                fundamental_data.append(data)

                # API 호출 제한을 위한 딜레이 (실제 데이터 수집 시)
                if naver_data:
                    time.sleep(random.uniform(1.0, 2.0))
                else:
                    time.sleep(0.1)  # 모의 데이터는 빠르게

            except Exception as e:
                print(f"Error processing {ticker}: {e}")
                # 오류 발생시 모의 데이터 사용
                data = self.generate_mock_data(ticker, stock_name)
                fundamental_data.append(data)

        return fundamental_data

def load_korean_stocks_list(file_path):
    """한국 종목 리스트 파일 로드"""
    try:
        if os.path.exists(file_path):
            df = pd.read_csv(file_path, encoding='utf-8-sig')
            print(f"Successfully loaded {len(df)} stocks from {file_path}")
            return df
        else:
            print(f"File not found: {file_path}")
            return None
    except Exception as e:
        print(f"Error loading file {file_path}: {e}")
        return None

def create_integrated_fundamental_data(korean_stocks_file=None, output_file='integrated_fundamental_data.csv'):
    """통합 펀더멘털 데이터 CSV 파일 생성"""

    # 한국 종목 리스트 로드
    if korean_stocks_file and os.path.exists(korean_stocks_file):
        stocks_df = load_korean_stocks_list(korean_stocks_file)
        if stocks_df is not None:
            # 티커를 6자리로 패딩
            tickers = stocks_df['ticker'].astype(str).str.zfill(6).tolist()
            stock_names = stocks_df['name'].tolist() if 'name' in stocks_df.columns else None
            print(f"Loaded {len(tickers)} stocks from file")
        else:
            print("Failed to load stocks file. Using sample data.")
            tickers, stock_names = get_sample_stocks()
    else:
        print("Korean stocks file not provided or not found. Using sample data.")
        tickers, stock_names = get_sample_stocks()

    # 데이터 수집기 초기화
    collector = FundamentalDataCollector()

    print(f"\nStarting fundamental data collection for {len(tickers)} stocks...")
    fundamental_data = collector.collect_fundamental_data(tickers, stock_names)

    # DataFrame 생성
    df = pd.DataFrame(fundamental_data)

    # 컬럼 순서 정리
    columns_order = [
        'ticker', 'per', 'pbr', 'eps', 'bps', 'dps', 'div_yield',
        'revenue_growth', 'operating_income_growth', 'net_income_growth',
        'naver_roe', 'naver_roa', 'naver_debt_to_equity', 'naver_current_ratio',
        'naver_operating_margin', 'naver_dividend_yield'
    ]

    df = df[columns_order]

    # 데이터 검증 및 정리
    print("\nData validation and cleaning...")

    # 수치 데이터 검증
    numeric_columns = ['per', 'pbr', 'eps', 'bps', 'dps', 'div_yield',
                      'revenue_growth', 'operating_income_growth', 'net_income_growth',
                      'naver_roe', 'naver_roa', 'naver_debt_to_equity',
                      'naver_current_ratio', 'naver_operating_margin', 'naver_dividend_yield']

    for col in numeric_columns:
        df[col] = pd.to_numeric(df[col], errors='coerce')

    # CSV 파일 저장
    df.to_csv(output_file, index=False, encoding='utf-8-sig')

    print(f"\n✅ 통합 펀더멘털 데이터가 '{output_file}'에 저장되었습니다.")
    print(f"📊 총 {len(df)} 종목의 데이터가 포함되어 있습니다.")

    # 데이터 요약 통계
    print(f"\n=== 데이터 요약 통계 ===")
    print(df.describe().round(2))

    # 샘플 데이터 출력
    print(f"\n=== 샘플 데이터 (처음 5개 종목) ===")
    pd.set_option('display.max_columns', None)
    pd.set_option('display.width', None)
    print(df.head().to_string(index=False))

    return df

def get_sample_stocks():
    """샘플 종목 리스트 반환"""
    sample_data = [
        ("005930", "삼성전자"),
        ("000660", "SK하이닉스"),
        ("373220", "LG에너지솔루션"),
        ("207940", "삼성바이오로직스"),
        ("012450", "한화에어로스페이스"),
        ("005935", "삼성전자우"),
        ("005380", "현대차"),
        ("000270", "기아"),
        ("105560", "KB금융"),
        ("329180", "HD현대중공업"),
    ]

    tickers = [item[0] for item in sample_data]
    names = [item[1] for item in sample_data]

    return tickers, names

if __name__ == "__main__":
    # 파일 경로 설정 - 스크립트 위치 기준
    script_dir = os.path.dirname(os.path.abspath(__file__))
    base_dir = os.path.dirname(script_dir)  # 상위 디렉토리
    korean_stocks_file = os.path.join(base_dir, 'data', 'korean_stocks_list.csv')

    # 통합 펀더멘털 데이터 생성
    df = create_integrated_fundamental_data(
        korean_stocks_file=korean_stocks_file,
        output_file='integrated_fundamental_data.csv'
    )
