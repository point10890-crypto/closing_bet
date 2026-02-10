import os
import pandas as pd
import numpy as np
import logging
from datetime import datetime, timedelta
from typing import Tuple, List, Dict, Optional
import warnings

# 경고 메시지 무시
warnings.filterwarnings('ignore')

# 로깅 설정
logging.basicConfig(
    level=logging.INFO, 
    format='%(asctime)s - %(levelname)s - %(message)s',
    datefmt='%Y-%m-%d %H:%M:%S'
)
logger = logging.getLogger(__name__)


class EnhancedWaveTransitionAnalyzerV3:
    """향상된 파동 전환 분석기 V3 - 실제 데이터 기반 분석"""

    def __init__(self, data_dir: str = None):
        # DATA_DIR 환경 변수 우선 사용
        if data_dir is None:
            data_dir = os.getenv('DATA_DIR', '.')
        self.data_dir = data_dir
        
        # 시장 레짐 설정
        self.market_regime = "UNKNOWN"
        self.risk_on_threshold = 0.65
        self.risk_off_threshold = 0.35
        
        # 분석 파라미터
        self.min_data_points = 60  # 최소 데이터 포인트
        self.volume_surge_threshold = 1.5  # 거래량 급증 기준
        self.momentum_threshold = 0.05  # 모멘텀 임계값
        
        # 데이터 파일 검증
        self._verify_data_files()
        
        logger.info(f"✅ 향상된 파동 전환 분석기 V3 초기화 완료")

    def _verify_data_files(self):
        """필수 데이터 파일 존재 여부 확인"""
        required_files = {
            'daily_prices.csv': '일별 가격 데이터',
            'korean_stocks_list.csv': '한국 주식 목록'
        }
        
        optional_files = {
            'all_institutional_trend_data.csv': '기관 수급 동향',
            'integrated_fundamental_data.csv': '통합 펀더멘털',
            'fundamentals.csv': '기본 펀더멘털'
        }
        
        logger.info("📂 데이터 파일 확인:")
        
        # 필수 파일 확인
        missing_required = []
        for file, desc in required_files.items():
            file_path = os.path.join(self.data_dir, file)
            if os.path.exists(file_path):
                size_mb = os.path.getsize(file_path) / 1024 / 1024
                logger.info(f"   ✅ {file}: {desc} ({size_mb:.1f}MB)")
            else:
                logger.error(f"   ❌ {file}: {desc} (없음)")
                missing_required.append(file)
        
        if missing_required:
            raise FileNotFoundError(f"필수 파일이 없습니다: {', '.join(missing_required)}")
        
        # 선택적 파일 확인
        for file, desc in optional_files.items():
            file_path = os.path.join(self.data_dir, file)
            if os.path.exists(file_path):
                size_mb = os.path.getsize(file_path) / 1024 / 1024
                logger.info(f"   ✅ {file}: {desc} ({size_mb:.1f}MB)")
            else:
                logger.info(f"   ⚠️  {file}: {desc} (없음 - 선택사항)")

    def load_real_price_data(self) -> pd.DataFrame:
        """실제 가격 데이터 로딩 및 검증"""
        try:
            prices_path = os.path.join(self.data_dir, 'daily_prices.csv')
            logger.info(f"📊 가격 데이터 로딩 중...")
            
            # 데이터 로드
            df = pd.read_csv(prices_path, dtype={'ticker': str})
            df['date'] = pd.to_datetime(df['date'])
            
            # 필수 컬럼 확인
            required_cols = ['ticker', 'date', 'current_price', 'high', 'low', 'volume']
            missing_cols = [col for col in required_cols if col not in df.columns]
            if missing_cols:
                raise ValueError(f"필수 컬럼 누락: {missing_cols}")
            
            # 데이터 정제
            initial_count = len(df)
            df = df.dropna(subset=['current_price', 'volume'])
            df = df[(df['current_price'] > 0) & (df['volume'] > 0)]
            
            # 이상치 제거
            df = df[df['current_price'] < df['current_price'].quantile(0.999)]
            
            cleaned_count = len(df)
            logger.info(f"✅ 데이터 로딩 완료: {cleaned_count:,}개 (정제: {initial_count-cleaned_count:,}개)")
            
            # 데이터 통계
            unique_tickers = df['ticker'].nunique()
            date_range = f"{df['date'].min().strftime('%Y-%m-%d')} ~ {df['date'].max().strftime('%Y-%m-%d')}"
            logger.info(f"   종목 수: {unique_tickers:,}개")
            logger.info(f"   기간: {date_range}")
            
            return df
            
        except Exception as e:
            logger.error(f"❌ 가격 데이터 로딩 실패: {e}")
            raise

    def check_market_regime(self) -> str:
        """시장 레짐 판단 (개선된 버전)"""
        logger.info("🌍 시장 레짐 분석 중...")
        
        try:
            df_prices = self.load_real_price_data()
            
            # 1. KOSPI 지수 기반 판단 시도
            kospi_tickers = ['^KOSPI', 'KS11', 'KOSPI', '069500', '122630']  # KODEX 레버리지 추가
            
            for ticker in kospi_tickers:
                kospi_data = df_prices[df_prices['ticker'] == ticker].copy()
                if len(kospi_data) >= 200:
                    kospi_data = kospi_data.sort_values('date')
                    
                    # 이동평균 계산
                    kospi_data['MA20'] = kospi_data['current_price'].rolling(20).mean()
                    kospi_data['MA50'] = kospi_data['current_price'].rolling(50).mean()
                    kospi_data['MA200'] = kospi_data['current_price'].rolling(200).mean()
                    
                    # 최근 데이터
                    latest = kospi_data.iloc[-1]
                    current_price = latest['current_price']
                    ma20 = latest['MA20']
                    ma50 = latest['MA50']
                    ma200 = latest['MA200']
                    
                    # 레짐 판단 (다중 조건)
                    if current_price > ma200 * 1.05 and ma20 > ma50:
                        self.market_regime = "RISK_ON"
                    elif current_price < ma200 * 0.95 and ma20 < ma50:
                        self.market_regime = "RISK_OFF"
                    else:
                        self.market_regime = "NEUTRAL"
                    
                    logger.info(f"✅ KOSPI 기반 시장 레짐: {self.market_regime}")
                    logger.info(f"   현재가: {current_price:,.0f}, MA200: {ma200:,.0f} ({current_price/ma200:.1%})")
                    return self.market_regime
            
            # 2. 전체 시장 추세 기반 판단
            self.market_regime = self._analyze_market_breadth(df_prices)
            return self.market_regime
            
        except Exception as e:
            logger.warning(f"⚠️ 시장 레짐 분석 실패: {e}")
            self.market_regime = "NEUTRAL"
            return self.market_regime

    def _analyze_market_breadth(self, df_prices: pd.DataFrame) -> str:
        """시장 폭 분석을 통한 레짐 판단"""
        try:
            latest_date = df_prices['date'].max()
            start_date = latest_date - timedelta(days=20)
            
            performance_stats = []
            
            for ticker in df_prices['ticker'].unique()[:500]:  # 상위 500개 종목만
                ticker_data = df_prices[df_prices['ticker'] == ticker]
                
                if len(ticker_data) < 20:
                    continue
                
                recent_data = ticker_data[ticker_data['date'] >= start_date].sort_values('date')
                if len(recent_data) >= 2:
                    price_change = (recent_data['current_price'].iloc[-1] / recent_data['current_price'].iloc[0]) - 1
                    
                    # 52주 신고가/신저가 체크
                    year_data = ticker_data[ticker_data['date'] >= latest_date - timedelta(days=252)]
                    if len(year_data) >= 50:
                        is_52w_high = recent_data['high'].iloc[-1] >= year_data['high'].max() * 0.98
                        is_52w_low = recent_data['low'].iloc[-1] <= year_data['low'].min() * 1.02
                        
                        performance_stats.append({
                            'price_change': price_change,
                            'is_52w_high': is_52w_high,
                            'is_52w_low': is_52w_low
                        })
            
            if len(performance_stats) > 30:
                df_stats = pd.DataFrame(performance_stats)
                
                # 상승/하락 종목 비율
                up_ratio = (df_stats['price_change'] > 0).mean()
                
                # 52주 신고가/신저가 비율
                new_high_ratio = df_stats['is_52w_high'].mean()
                new_low_ratio = df_stats['is_52w_low'].mean()
                
                # 평균 수익률
                avg_return = df_stats['price_change'].mean()
                
                logger.info(f"📊 시장 폭 분석:")
                logger.info(f"   상승 종목: {up_ratio:.1%}")
                logger.info(f"   52주 신고가: {new_high_ratio:.1%}")
                logger.info(f"   52주 신저가: {new_low_ratio:.1%}")
                logger.info(f"   평균 수익률: {avg_return:.1%}")
                
                # 종합 판단
                if up_ratio > self.risk_on_threshold and new_high_ratio > 0.1:
                    return "RISK_ON"
                elif up_ratio < self.risk_off_threshold or new_low_ratio > 0.1:
                    return "RISK_OFF"
                else:
                    return "NEUTRAL"
            
            return "NEUTRAL"
            
        except Exception as e:
            logger.warning(f"⚠️ 시장 폭 분석 실패: {e}")
            return "NEUTRAL"

    def detect_wave_transitions_real_data(self, df_prices: pd.DataFrame = None) -> pd.DataFrame:
        """실제 데이터 기반 파동 전환 감지 (개선된 버전)"""
        logger.info("🌊 파동 전환 종목 탐색 중...")
        
        if df_prices is None:
            df_prices = self.load_real_price_data()
        
        if df_prices.empty:
            logger.error("❌ 가격 데이터가 없습니다")
            return pd.DataFrame()
        
        transition_candidates = []
        tickers = df_prices['ticker'].unique()
        total_tickers = len(tickers)
        
        logger.info(f"📊 총 {total_tickers:,}개 종목 분석")
        
        for i, ticker in enumerate(tickers):
            if (i + 1) % 100 == 0:
                progress = (i + 1) / total_tickers * 100
                logger.info(f"   진행중... {i+1:,}/{total_tickers:,} ({progress:.1f}%)")
            
            try:
                # 종목 데이터 추출
                ticker_data = df_prices[df_prices['ticker'] == ticker].sort_values('date')
                
                if len(ticker_data) < self.min_data_points:
                    continue
                
                # 기술적 지표 계산
                indicators = self._calculate_technical_indicators(ticker_data)
                
                if indicators is None:
                    continue
                
                # 파동 단계 판단
                wave_stage, score = self._determine_wave_stage(indicators)
                
                if wave_stage is None:
                    continue
                
                # 전환 후보 추가
                transition_candidates.append({
                    'ticker': ticker,
                    'current_price': indicators['current_price'],
                    'ratio_52w': indicators['ratio_52w'],
                    'ma20': indicators['ma20'],
                    'ma50': indicators['ma50'],
                    'transition_volume_ratio': indicators['volume_ratio'],
                    'price_change_20d': indicators['price_change_20d'],
                    'price_change_6m': indicators['price_change_6m'],
                    'transition_score': score,
                    'wave_stage': wave_stage,
                    'current_date': indicators['current_date'],
                    'rsi': indicators.get('rsi', 50),
                    'macd_signal': indicators.get('macd_signal', 'neutral')
                })
                
            except Exception as e:
                logger.debug(f"⚠️ {ticker} 분석 오류: {e}")
                continue
        
        if not transition_candidates:
            logger.warning("⚠️ 전환 종목이 발견되지 않았습니다")
            return pd.DataFrame()
        
        # 결과 데이터프레임 생성
        transition_df = pd.DataFrame(transition_candidates)
        
        # 파동단계별 통계
        logger.info(f"✅ 전환 종목 발견: {len(transition_df):,}개")
        stage_counts = transition_df['wave_stage'].value_counts()
        for stage, count in stage_counts.items():
            logger.info(f"   {stage}: {count}개")
        
        return transition_df

    def _calculate_technical_indicators(self, ticker_data: pd.DataFrame) -> Optional[Dict]:
        """기술적 지표 계산"""
        try:
            # 최근 데이터
            latest = ticker_data.iloc[-1]
            current_price = latest['current_price']
            current_date = latest['date']
            
            # 52주 고저
            year_ago = current_date - timedelta(days=365)
            year_data = ticker_data[ticker_data['date'] >= year_ago]
            
            if len(year_data) < 30:
                return None
            
            high_52w = year_data['high'].max()
            low_52w = year_data['low'].min()
            
            # 52주 범위가 너무 좁으면 제외
            if high_52w == low_52w or (high_52w - low_52w) / low_52w < 0.1:
                return None
            
            ratio_52w = (current_price - low_52w) / (high_52w - low_52w)
            
            # 이동평균
            ticker_data['MA20'] = ticker_data['current_price'].rolling(20).mean()
            ticker_data['MA50'] = ticker_data['current_price'].rolling(50).mean()
            ticker_data['MA200'] = ticker_data['current_price'].rolling(200).mean()
            
            ma20 = ticker_data['MA20'].iloc[-1]
            ma50 = ticker_data['MA50'].iloc[-1]
            ma200 = ticker_data['MA200'].iloc[-1] if len(ticker_data) >= 200 else ma50
            
            # 거래량 분석
            recent_volume = ticker_data['volume'].tail(5).mean()
            avg_volume_20 = ticker_data['volume'].tail(20).mean()
            volume_ratio = recent_volume / avg_volume_20 if avg_volume_20 > 0 else 1
            
            # 가격 변화율
            price_change_20d = 0
            if len(ticker_data) >= 21:
                price_20d_ago = ticker_data['current_price'].iloc[-21]
                price_change_20d = (current_price - price_20d_ago) / price_20d_ago
            
            price_change_6m = 0
            if len(ticker_data) >= 126:
                price_6m_ago = ticker_data['current_price'].iloc[-126]
                price_change_6m = (current_price - price_6m_ago) / price_6m_ago
            
            # RSI 계산
            rsi = self._calculate_rsi(ticker_data['current_price'], period=14)
            
            # MACD 신호
            macd_signal = self._calculate_macd_signal(ticker_data['current_price'])
            
            return {
                'current_price': current_price,
                'current_date': current_date,
                'ratio_52w': ratio_52w,
                'high_52w': high_52w,
                'low_52w': low_52w,
                'ma20': ma20,
                'ma50': ma50,
                'ma200': ma200,
                'volume_ratio': volume_ratio,
                'price_change_20d': price_change_20d,
                'price_change_6m': price_change_6m,
                'rsi': rsi,
                'macd_signal': macd_signal
            }
            
        except Exception as e:
            logger.debug(f"지표 계산 오류: {e}")
            return None

    def _calculate_rsi(self, prices: pd.Series, period: int = 14) -> float:
        """RSI 계산"""
        try:
            delta = prices.diff()
            gain = (delta.where(delta > 0, 0)).rolling(window=period).mean()
            loss = (-delta.where(delta < 0, 0)).rolling(window=period).mean()
            
            rs = gain / loss
            rsi = 100 - (100 / (1 + rs))
            
            return rsi.iloc[-1] if not pd.isna(rsi.iloc[-1]) else 50
        except:
            return 50

    def _calculate_macd_signal(self, prices: pd.Series) -> str:
        """MACD 신호 계산"""
        try:
            # EMA 계산
            ema12 = prices.ewm(span=12).mean()
            ema26 = prices.ewm(span=26).mean()
            
            # MACD 라인
            macd = ema12 - ema26
            signal = macd.ewm(span=9).mean()
            
            # 신호 판단
            if macd.iloc[-1] > signal.iloc[-1] and macd.iloc[-2] <= signal.iloc[-2]:
                return "bullish"
            elif macd.iloc[-1] < signal.iloc[-1] and macd.iloc[-2] >= signal.iloc[-2]:
                return "bearish"
            else:
                return "neutral"
        except:
            return "neutral"

    def _determine_wave_stage(self, indicators: Dict) -> Tuple[Optional[str], Optional[float]]:
        """파동 단계 및 점수 결정"""
        try:
            # 지표 추출
            ratio_52w = indicators['ratio_52w']
            ma20 = indicators['ma20']
            ma50 = indicators['ma50']
            ma200 = indicators['ma200']
            current_price = indicators['current_price']
            volume_ratio = indicators['volume_ratio']
            price_change_20d = indicators['price_change_20d']
            rsi = indicators['rsi']
            
            # 파동 단계별 조건 체크
            
            # 2단계 중기 (강한 상승 추세)
            if (0.60 <= ratio_52w <= 0.90 and
                ma20 > ma50 > ma200 and
                current_price > ma20 * 1.02 and
                volume_ratio > 1.3 and
                price_change_20d > 0.10 and
                55 <= rsi <= 75):
                return "2단계 중기", 90
            
            # 2단계 초기 (상승 시작)
            elif (0.40 <= ratio_52w <= 0.75 and
                  ma20 > ma50 * 1.01 and
                  current_price > ma20 and
                  volume_ratio > 1.2 and
                  price_change_20d > 0.05 and
                  50 <= rsi <= 70):
                return "2단계 초기", 80
            
            # 1단계→2단계 전환
            elif (0.25 <= ratio_52w <= 0.60 and
                  ma20 > ma50 * 0.98 and
                  abs(current_price - ma20) / ma20 < 0.10 and
                  volume_ratio > 1.0 and
                  price_change_20d > -0.05 and
                  45 <= rsi <= 65):
                return "1단계→2단계 전환", 70
            
            # 상승추세 (일반)
            elif (0.30 <= ratio_52w <= 0.70 and
                  ma20 > ma50 and
                  price_change_20d >= 0 and
                  volume_ratio > 0.8):
                return "상승추세", 60
            
            else:
                return None, None
                
        except Exception as e:
            logger.debug(f"파동 단계 판단 오류: {e}")
            return None, None

    def collect_korean_fundamental_data(self, tickers: List[str]) -> pd.DataFrame:
        """한국 주식 펀더멘털 데이터 수집"""
        logger.info("💰 펀더멘털 데이터 수집 중...")
        
        fundamental_df = pd.DataFrame()
        
        # 데이터 파일 우선순위
        data_files = [
            'integrated_fundamental_data.csv',
            'fundamentals.csv'
        ]
        
        # 데이터 로드 시도
        for file_name in data_files:
            file_path = os.path.join(self.data_dir, file_name)
            if os.path.exists(file_path):
                try:
                    df = pd.read_csv(file_path, dtype={'ticker': str})
                    df = df[df['ticker'].isin(tickers)]
                    
                    if not df.empty:
                        fundamental_df = df
                        logger.info(f"✅ {file_name}에서 {len(df)}개 종목 로드")
                        break
                        
                except Exception as e:
                    logger.warning(f"⚠️ {file_name} 로드 실패: {e}")
        
        # 주식 정보 병합
        try:
            stock_info = pd.read_csv(
                os.path.join(self.data_dir, 'korean_stocks_list.csv'), 
                dtype={'ticker': str}
            )
            
            if 'name' in stock_info.columns:
                stock_info = stock_info[['ticker', 'name', 'market']]
                
                if not fundamental_df.empty:
                    fundamental_df = fundamental_df.merge(
                        stock_info, on='ticker', how='left', suffixes=('', '_y')
                    )
                    # 중복 컬럼 제거
                    duplicate_cols = [col for col in fundamental_df.columns if col.endswith('_y')]
                    fundamental_df = fundamental_df.drop(columns=duplicate_cols)
                else:
                    fundamental_df = stock_info[stock_info['ticker'].isin(tickers)].copy()
                    
        except Exception as e:
            logger.warning(f"⚠️ 주식 정보 병합 실패: {e}")
        
        # 섹터 정보 보완
        if 'sector' not in fundamental_df.columns and 'market' in fundamental_df.columns:
            fundamental_df['sector'] = fundamental_df['market']
        
        logger.info(f"✅ 펀더멘털 데이터 수집 완료: {len(fundamental_df)}개 종목")
        
        return fundamental_df

    def calculate_fundamental_scores(self, fundamental_df: pd.DataFrame) -> pd.DataFrame:
        """펀더멘털 점수 계산 (개선된 버전)"""
        logger.info("📊 펀더멘털 점수 계산 중...")
        
        if fundamental_df.empty:
            return fundamental_df
        
        # 컬럼명 매핑 (integrated_fundamental_data.csv 기준)
        column_mapping = {
            'per': 'pe_ratio',
            'pbr': 'pb_ratio',
            'div_yield': 'dividend_yield',
            'revenue_growth': 'revenue_growth',
            'operating_income_growth': 'operating_income_growth',
            'net_income_growth': 'net_income_growth',
            'naver_roe': 'roe',
            'naver_roa': 'roa',
            'naver_debt_to_equity': 'debt_to_equity',
            'naver_current_ratio': 'current_ratio',
            'naver_operating_margin': 'operating_margin',
            'naver_dividend_yield': 'dividend_yield'
        }
        
        # 컬럼명 변경
        for old_col, new_col in column_mapping.items():
            if old_col in fundamental_df.columns:
                fundamental_df[new_col] = fundamental_df[old_col]
        
        # 각 지표별 점수 계산
        scores = pd.DataFrame(index=fundamental_df.index)
        
        # 1. 성장성 점수
        growth_metrics = ['revenue_growth', 'operating_income_growth', 'net_income_growth']
        available_growth = [col for col in growth_metrics if col in fundamental_df.columns]
        
        if available_growth:
            growth_data = fundamental_df[available_growth].fillna(0).clip(-1, 2)
            scores['growth_score'] = np.clip(growth_data.mean(axis=1) * 50 + 50, 0, 100)
        else:
            scores['growth_score'] = 50
        
        # 2. 수익성 점수
        if 'roe' in fundamental_df.columns:
            scores['roe_score'] = np.clip(fundamental_df['roe'] * 2.5, 0, 50)
        else:
            scores['roe_score'] = 25
            
        if 'operating_margin' in fundamental_df.columns:
            scores['margin_score'] = np.clip(fundamental_df['operating_margin'] * 2.5, 0, 50)
        else:
            scores['margin_score'] = 25
            
        scores['profitability_score'] = scores['roe_score'] + scores['margin_score']
        
        # 3. 안정성 점수
        if 'debt_to_equity' in fundamental_df.columns:
            # 부채비율 역수 (낮을수록 좋음)
            debt_data = fundamental_df['debt_to_equity'].fillna(1)
            scores['debt_score'] = np.clip((2 - debt_data) * 30, 0, 60)
        else:
            scores['debt_score'] = 30
            
        if 'current_ratio' in fundamental_df.columns:
            # 유동비율 (높을수록 좋음)
            current_data = fundamental_df['current_ratio'].fillna(1)
            scores['liquidity_score'] = np.clip(current_data * 20, 0, 40)
        else:
            scores['liquidity_score'] = 20
            
        scores['stability_score'] = scores['debt_score'] + scores['liquidity_score']
        
        # 4. 가치 점수
        if 'pe_ratio' in fundamental_df.columns:
            pe_data = fundamental_df['pe_ratio'].fillna(20)
            # 음수 PER 처리
            scores['pe_score'] = pe_data.apply(
                lambda x: np.clip((30 - x) * 2, 0, 40) if x > 0 else 0
            )
        else:
            scores['pe_score'] = 20
            
        if 'pb_ratio' in fundamental_df.columns:
            pb_data = fundamental_df['pb_ratio'].fillna(1.5)
            scores['pb_score'] = np.clip((3 - pb_data) * 10, 0, 30)
        else:
            scores['pb_score'] = 15
            
        if 'dividend_yield' in fundamental_df.columns:
            div_data = fundamental_df['dividend_yield'].fillna(0)
            scores['div_score'] = np.clip(div_data * 10, 0, 30)
        else:
            scores['div_score'] = 15
            
        scores['value_score'] = scores['pe_score'] + scores['pb_score'] + scores['div_score']
        
        # 5. 현금흐름 점수 (배당수익률로 대체)
        if 'dividend_yield' in fundamental_df.columns:
            div_yield_data = fundamental_df['dividend_yield'].fillna(0)
            scores['cash_flow_score'] = np.clip(div_yield_data * 10, 0, 100)
        else:
            scores['cash_flow_score'] = 50
        
        # 6. 종합 점수 계산
        fundamental_df['growth_score'] = scores['growth_score'].round(1)
        fundamental_df['profitability_score'] = scores['profitability_score'].round(1)
        fundamental_df['stability_score'] = scores['stability_score'].round(1)
        fundamental_df['value_score'] = scores['value_score'].round(1)
        fundamental_df['cash_flow_score'] = scores['cash_flow_score'].round(1)
        
        # 가중 평균
        fundamental_df['fundamental_score'] = (
            scores['growth_score'] * 0.25 +
            scores['profitability_score'] * 0.25 +
            scores['stability_score'] * 0.20 +
            scores['value_score'] * 0.20 +
            scores['cash_flow_score'] * 0.10
        ).round(1)
        
        logger.info("✅ 펀더멘털 점수 계산 완료")
        return fundamental_df

    def analyze_institutional_supply_demand(self, tickers: List[str]) -> pd.DataFrame:
        """기관/외국인 수급 분석"""
        logger.info("🏢 기관/외국인 수급 분석 중...")
        
        file_path = os.path.join(self.data_dir, 'all_institutional_trend_data.csv')
        
        if not os.path.exists(file_path):
            logger.warning("⚠️ 기관 수급 데이터 파일이 없습니다")
            return pd.DataFrame()
        
        try:
            # 데이터 로드
            df = pd.read_csv(file_path, dtype={'ticker': str})
            df = df[df['ticker'].isin(tickers)]
            
            if df.empty:
                logger.warning("⚠️ 해당 종목의 수급 데이터가 없습니다")
                return pd.DataFrame()
            
            # 수급 지표 계산
            df = self._calculate_supply_demand_indicators(df)
            
            logger.info(f"✅ 수급 분석 완료: {len(df)}개 종목")
            return df
            
        except Exception as e:
            logger.error(f"❌ 수급 데이터 로드 실패: {e}")
            return pd.DataFrame()

    def _calculate_supply_demand_indicators(self, df: pd.DataFrame) -> pd.DataFrame:
        """수급 지표 계산"""
        # 기본값 설정
        supply_demand_columns = {
            'institutional_net_buy_20d': 0,
            'institutional_net_buy_5d': 0,
            'foreign_net_buy_20d': 0,
            'foreign_net_buy_5d': 0,
            'institutional_ratio_20d': 0,
            'foreign_ratio_20d': 0
        }
        
        for col, default in supply_demand_columns.items():
            if col not in df.columns:
                df[col] = default
        
        # 수급 지수 계산 (0-100)
        inst_score = np.clip(df['institutional_ratio_20d'] * 5, 0, 50)
        foreign_score = np.clip(df['foreign_ratio_20d'] * 5, 0, 50)
        
        # 순매수 강도 반영
        if df['institutional_net_buy_20d'].std() > 0:
            inst_buy_z = (df['institutional_net_buy_20d'] - df['institutional_net_buy_20d'].mean()) / df['institutional_net_buy_20d'].std()
            inst_score += np.clip(inst_buy_z * 10, -10, 10)
            
        if df['foreign_net_buy_20d'].std() > 0:
            foreign_buy_z = (df['foreign_net_buy_20d'] - df['foreign_net_buy_20d'].mean()) / df['foreign_net_buy_20d'].std()
            foreign_score += np.clip(foreign_buy_z * 10, -10, 10)
        
        df['supply_demand_index'] = np.clip(inst_score + foreign_score, 0, 100)
        
        # 수급 단계 분류
        df['supply_demand_stage'] = df['supply_demand_index'].apply(
            lambda x: '강한매집' if x >= 70 else '매집' if x >= 50 else '중립' if x >= 30 else '분산'
        )
        
        # 매집 강도
        df['accumulation_intensity'] = df.apply(
            lambda row: '매우강함' if row['institutional_ratio_20d'] > 15 and row['foreign_ratio_20d'] > 10
            else '강함' if row['institutional_ratio_20d'] > 10 or row['foreign_ratio_20d'] > 10
            else '보통' if row['institutional_ratio_20d'] > 5 or row['foreign_ratio_20d'] > 5
            else '약함',
            axis=1
        )
        
        return df

    def screen_quantitative_factors(self, df: pd.DataFrame) -> pd.DataFrame:
        """정량적 팩터 스크리닝"""
        logger.info("📊 정량적 팩터 스크리닝 중...")
        
        if df.empty:
            return df
        
        # 상대강도 (모멘텀)
        if 'price_change_6m' in df.columns:
            df['relative_strength_6m'] = df['price_change_6m'].clip(-0.5, 3).rank(pct=True)
        else:
            df['relative_strength_6m'] = 0.5
            
        if 'price_change_20d' in df.columns:
            df['relative_strength_1m'] = df['price_change_20d'].clip(-0.2, 0.5).rank(pct=True)
        else:
            df['relative_strength_1m'] = 0.5
        
        # 가치 팩터
        if 'pe_ratio' in df.columns:
            # 음수 PER 처리
            df['pe_rank'] = df['pe_ratio'].apply(
                lambda x: 0 if x <= 0 or x > 100 else 1 / (1 + x)
            ).rank(pct=True)
        else:
            df['pe_rank'] = 0.5
            
        if 'pb_ratio' in df.columns:
            df['pb_rank'] = (1 / (1 + df['pb_ratio'].clip(0, 10))).rank(pct=True)
        else:
            df['pb_rank'] = 0.5
        
        # 품질 팩터
        if 'roe' in df.columns:
            df['roe_rank'] = df['roe'].clip(-50, 50).rank(pct=True)
        else:
            df['roe_rank'] = 0.5
            
        if 'debt_to_equity' in df.columns:
            df['debt_rank'] = (1 / (1 + df['debt_to_equity'].clip(0, 5))).rank(pct=True)
        else:
            df['debt_rank'] = 0.5
        
        # 거래활동성
        if 'transition_volume_ratio' in df.columns:
            df['volume_activity_rank'] = df['transition_volume_ratio'].clip(0.5, 3).rank(pct=True)
        else:
            df['volume_activity_rank'] = 0.5
        
        # 종합 정량적 점수
        df['quantitative_score'] = (
            df['relative_strength_6m'] * 0.25 +      # 장기 모멘텀
            df['relative_strength_1m'] * 0.15 +      # 단기 모멘텀
            df['pe_rank'] * 0.15 +                  # 가치 (PER)
            df['pb_rank'] * 0.15 +                  # 가치 (PBR)
            df['roe_rank'] * 0.15 +                 # 품질 (ROE)
            df['debt_rank'] * 0.05 +                # 안정성
            df['volume_activity_rank'] * 0.10       # 거래활동성
        ) * 100
        
        df['quantitative_score'] = df['quantitative_score'].round(1)
        
        logger.info("✅ 정량적 팩터 스크리닝 완료")
        return df

    def apply_dynamic_allocation(self, df: pd.DataFrame) -> pd.DataFrame:
        """시장 레짐에 따른 동적 자산 배분"""
        logger.info("💰 동적 자산 배분 적용 중...")
        
        if df.empty:
            return df
        
        # 시장 레짐별 조정
        if self.market_regime == "RISK_OFF":
            logger.info("⚠️ 리스크 오프 모드 - 보수적 접근")
            df['final_signal'] = df['final_investment_score'] >= 85
            # 점수에 따른 포지션 크기 계산 (0점이어도 최소 0.1)
            df['position_size'] = np.clip(df['final_investment_score'] / 100 * 0.5, 0.1, 0.5)
            df['risk_adjusted_score'] = df['final_investment_score'] * 0.8
            
        elif self.market_regime == "RISK_ON":
            logger.info("🚀 리스크 온 모드 - 적극적 접근")
            df['final_signal'] = df['final_investment_score'] >= 70
            # 점수에 따른 포지션 크기 계산 (0점이어도 최소 0.1)
            df['position_size'] = np.clip(df['final_investment_score'] / 100 * 1.0, 0.1, 1.0)
            df['risk_adjusted_score'] = df['final_investment_score'] * 1.1
            
        else:  # NEUTRAL
            logger.info("⚖️ 중립 모드 - 균형적 접근")
            df['final_signal'] = df['final_investment_score'] >= 75
            # 점수에 따른 포지션 크기 계산 (0점이어도 최소 0.1)
            df['position_size'] = np.clip(df['final_investment_score'] / 100 * 0.8, 0.1, 0.8)
            df['risk_adjusted_score'] = df['final_investment_score'] * 1.0
        
        # 점수 상한 적용
        df['risk_adjusted_score'] = df['risk_adjusted_score'].clip(0, 100).round(1)
        
        # 포지션 크기 조정 (개별 종목 특성 반영)
        # 고품질 종목은 포지션 증가
        if 'fundamental_score' in df.columns and 'stability_score' in df.columns:
            high_quality = (df['fundamental_score'] > 80) & (df['stability_score'] > 70)
            df.loc[high_quality, 'position_size'] *= 1.2
        
        # 고위험 종목은 포지션 감소
        high_risk_conditions = []
        
        if 'debt_to_equity' in df.columns:
            high_risk_conditions.append(df['debt_to_equity'] > 2)
            
        if 'pe_ratio' in df.columns:
            high_risk_conditions.append(df['pe_ratio'] < 0)
        
        if high_risk_conditions:
            high_risk = pd.concat(high_risk_conditions, axis=1).any(axis=1)
            df.loc[high_risk, 'position_size'] *= 0.7
        
        # 점수별 포지션 크기 세밀 조정
        # 90점 이상: 최대 포지션
        # 80-89점: 높은 포지션
        # 70-79점: 중간 포지션
        # 60-69점: 낮은 포지션
        # 60점 미만: 최소 포지션
        score_bonus = np.where(
            df['final_investment_score'] >= 90, 1.3,
            np.where(df['final_investment_score'] >= 80, 1.1,
            np.where(df['final_investment_score'] >= 70, 1.0,
            np.where(df['final_investment_score'] >= 60, 0.8, 0.6)))
        )
        df['position_size'] *= score_bonus
        
        # 최대 포지션 제한
        df['position_size'] = df['position_size'].clip(0.05, 1.5)
        
        return df

    def calculate_final_investment_scores(self, merged_results: pd.DataFrame) -> pd.DataFrame:
        """최종 투자 점수 계산 (향상된 버전)"""
        logger.info("🎯 최종 투자 점수 계산 중...")
        
        if merged_results.empty:
            return pd.DataFrame()
        
        # 점수 구성 요소 초기화
        score_components = {}
        
        # 1. 기술적 전환 점수
        score_components['technical'] = np.clip(merged_results['transition_score'], 0, 100)
        
        # 2. 수급 점수
        if 'supply_demand_index' in merged_results.columns:
            score_components['supply_demand'] = merged_results['supply_demand_index']
        else:
            # 기관/외국인 데이터로부터 계산
            inst_score = 50
            foreign_score = 50
            
            if 'institutional_ratio_20d' in merged_results.columns:
                inst_score = np.clip(merged_results['institutional_ratio_20d'] * 5, 0, 100)
                
            if 'foreign_ratio_20d' in merged_results.columns:
                foreign_score = np.clip(merged_results['foreign_ratio_20d'] * 5, 0, 100)
                
            score_components['supply_demand'] = (inst_score + foreign_score) / 2
        
        # 3. 거래량 점수
        if 'transition_volume_ratio' in merged_results.columns:
            volume_score = np.where(
                merged_results['transition_volume_ratio'] > 2, 100,
                np.where(merged_results['transition_volume_ratio'] > 1.5, 80,
                np.where(merged_results['transition_volume_ratio'] > 1.2, 60, 40))
            )
            score_components['volume'] = volume_score
        else:
            score_components['volume'] = 50
        
        # 4. 모멘텀 점수
        momentum_short = 50
        momentum_long = 50
        
        if 'price_change_20d' in merged_results.columns:
            momentum_short = np.clip(merged_results['price_change_20d'] * 200 + 50, 0, 100)
            
        if 'price_change_6m' in merged_results.columns:
            momentum_long = np.clip(merged_results['price_change_6m'] * 100 + 50, 0, 100)
            
        score_components['momentum'] = (momentum_short * 0.6 + momentum_long * 0.4)
        
        # 5. 52주 위치 점수
        if 'ratio_52w' in merged_results.columns:
            # 52주 고점 근처(80-90%)가 최적
            ratio = merged_results['ratio_52w']
            position_score = np.where(
                (ratio >= 0.8) & (ratio <= 0.9), 100,
                np.where((ratio >= 0.7) & (ratio < 0.8), 80,
                np.where((ratio >= 0.6) & (ratio < 0.7), 60,
                np.where((ratio >= 0.4) & (ratio < 0.6), 40, 20)))
            )
            score_components['position_52w'] = position_score
        else:
            score_components['position_52w'] = 50
        
        # 6. 펀더멘털 점수
        if 'fundamental_score' in merged_results.columns:
            score_components['fundamental'] = merged_results['fundamental_score']
        else:
            score_components['fundamental'] = 50
        
        # 7. 정량적 팩터 점수
        if 'quantitative_score' not in merged_results.columns:
            merged_results = self.screen_quantitative_factors(merged_results)
        score_components['quantitative'] = merged_results['quantitative_score']
        
        # 8. 파동 단계 보너스 (조정됨)
        wave_bonus = merged_results['wave_stage'].map({
            '2단계 중기': 12,
            '2단계 초기': 8,
            '1단계→2단계 전환': 5,
            '상승추세': 2
        }).fillna(0)
        
        # 9. 특별 보너스 계산
        special_bonus = 0
        
        # 강한 기관 매집
        if 'institutional_ratio_20d' in merged_results.columns:
            strong_inst = merged_results['institutional_ratio_20d'] > 15
            special_bonus += strong_inst * 6
        
        # RSI 적정 구간
        if 'rsi' in merged_results.columns:
            optimal_rsi = (merged_results['rsi'] >= 50) & (merged_results['rsi'] <= 70)
            special_bonus += optimal_rsi * 3
        
        # MACD 상승 신호
        if 'macd_signal' in merged_results.columns:
            bullish_macd = merged_results['macd_signal'] == 'bullish'
            special_bonus += bullish_macd * 3
        
        # 10. 가중치 설정 (데이터 가용성에 따라 동적 조정)
        weights = {
            'technical': 0.20,
            'supply_demand': 0.20,
            'volume': 0.10,
            'momentum': 0.15,
            'position_52w': 0.10,
            'fundamental': 0.20,
            'quantitative': 0.05
        }
        
        # 사용 가능한 점수만으로 가중치 재조정
        available_weights = {}
        total_weight = 0
        
        for component, weight in weights.items():
            if component in score_components and score_components[component].sum() > 0:
                available_weights[component] = weight
                total_weight += weight
        
        # 가중치 정규화
        if total_weight > 0:
            for component in available_weights:
                available_weights[component] /= total_weight
        
        # 최종 점수 계산
        base_score = 0
        for component, weight in available_weights.items():
            base_score += score_components[component] * weight
        
        # 보너스 추가
        merged_results['final_investment_score'] = np.clip(
            base_score + wave_bonus + special_bonus, 0, 100
        ).round(1)
        
        # 11. 투자 등급 분류 (더 엄격한 기준)
        merged_results['investment_grade'] = merged_results['final_investment_score'].apply(
            lambda x: "S급 (즉시 매수)" if x >= 90
            else "A급 (적극 매수)" if x >= 80
            else "B급 (매수 고려)" if x >= 70
            else "C급 (관망)" if x >= 60
            else "D급 (회피)"
        )
        
        # 12. 투자 카테고리 분류
        merged_results['investment_category'] = merged_results.apply(
            self._classify_investment_category, axis=1
        )
        
        # 13. 동적 자산 배분 적용
        merged_results = self.apply_dynamic_allocation(merged_results)
        
        # 14. 순위 매기기
        merged_results = merged_results.sort_values(
            'risk_adjusted_score', ascending=False
        ).reset_index(drop=True)
        merged_results['rank'] = range(1, len(merged_results) + 1)
        
        # 점수 구성 요소 저장 (디버깅용)
        for component, scores in score_components.items():
            merged_results[f'score_{component}'] = scores.round(1)
        
        logger.info(f"✅ 최종 투자 점수 계산 완료: {len(merged_results)}개 종목")
        
        return merged_results

    def _classify_investment_category(self, row) -> str:
        """투자 카테고리 분류"""
        tech_score = row.get('transition_score', 50)
        fund_score = row.get('fundamental_score', 50)
        quant_score = row.get('quantitative_score', 50)
        
        if tech_score >= 80 and fund_score >= 80:
            return '성장가치 복합형'
        elif tech_score >= 80 and quant_score >= 70:
            return '모멘텀 추종형'
        elif fund_score >= 80 and row.get('value_score', 50) >= 70:
            return '가치 투자형'
        elif tech_score >= 70 and row.get('supply_demand_index', 50) >= 70:
            return '수급 주도형'
        elif fund_score >= 70 and row.get('stability_score', 50) >= 70:
            return '안정 성장형'
        else:
            return '일반 투자형'

    def analyze_korean_sectors(self, df: pd.DataFrame) -> str:
        """섹터별 분석 리포트"""
        if df.empty or 'sector' not in df.columns:
            return "⚠️ 섹터 정보가 없습니다."
        
        # 섹터별 통계 (존재하는 컬럼만)
        agg_dict = {'final_investment_score': ['mean', 'count']}
        
        if 'risk_adjusted_score' in df.columns:
            agg_dict['risk_adjusted_score'] = 'mean'
        if 'fundamental_score' in df.columns:
            agg_dict['fundamental_score'] = 'mean'
        if 'quantitative_score' in df.columns:
            agg_dict['quantitative_score'] = 'mean'
            
        sector_stats = df.groupby('sector').agg(agg_dict).round(1)
        
        # 상위 등급 종목 수
        top_grades = df[df['investment_grade'].str.contains('S급|A급')].groupby('sector').size()
        
        report = "\n🏢 === 섹터별 분석 ===\n"
        
        # 섹터별 점수 순위
        sector_scores = sector_stats[('final_investment_score', 'mean')].sort_values(ascending=False)
        
        for rank, (sector, avg_score) in enumerate(sector_scores.items(), 1):
            count = int(sector_stats.loc[sector, ('final_investment_score', 'count')])
            top_count = top_grades.get(sector, 0)
            
            report += f"\n{rank}. {sector}:\n"
            report += f"   종목 수: {count}개 (S/A급: {top_count}개)\n"
            report += f"   평균 점수: {avg_score:.1f}"
            
            # 리스크조정 점수
            if 'risk_adjusted_score' in sector_stats.columns:
                risk_adj = sector_stats.loc[sector, ('risk_adjusted_score', 'mean')]
                report += f" (리스크조정: {risk_adj:.1f})"
            report += "\n"
            
            # 펀더멘털/정량적 점수
            score_info = []
            if 'fundamental_score' in sector_stats.columns:
                fund_score = sector_stats.loc[sector, ('fundamental_score', 'mean')]
                score_info.append(f"펀더멘털: {fund_score:.1f}")
            if 'quantitative_score' in sector_stats.columns:
                quant_score = sector_stats.loc[sector, ('quantitative_score', 'mean')]
                score_info.append(f"정량적: {quant_score:.1f}")
            
            if score_info:
                report += f"   {', '.join(score_info)}\n"
            
            # 섹터 내 상위 3개 종목
            top_stocks = df[df['sector'] == sector].nlargest(3, 'risk_adjusted_score')
            if not top_stocks.empty:
                report += "   TOP 3:\n"
                for _, stock in top_stocks.iterrows():
                    name = stock.get('name', stock['ticker'])
                    score = stock['risk_adjusted_score']
                    grade = stock['investment_grade'].split()[0]
                    report += f"     • {stock['ticker']} {name}: {score:.1f}점 ({grade})\n"
        
        return report

    def generate_enhanced_report_v3(self, final_results: pd.DataFrame) -> str:
        """향상된 투자 리포트 생성"""
        if final_results.empty:
            return "❌ 분석 결과가 없습니다."
        
        # 통계 계산
        total_count = len(final_results)
        avg_score = final_results['final_investment_score'].mean()
        avg_risk_adj = final_results['risk_adjusted_score'].mean()
        
        # 매수 신호 종목
        buy_signals = final_results[final_results.get('final_signal', False)]
        buy_count = len(buy_signals)
        
        # 등급별 분포
        grade_dist = final_results['investment_grade'].value_counts()
        
        # 카테고리별 분포
        category_dist = final_results['investment_category'].value_counts()
        
        # 파동 단계별 분포
        wave_dist = final_results['wave_stage'].value_counts()
        
        # 섹터 분석
        sector_report = self.analyze_korean_sectors(final_results)
        
        # 현재 시간
        current_time = datetime.now().strftime('%Y-%m-%d %H:%M:%S')
        
        report = f"""
═══════════════════════════════════════════════════════════
        🔥 향상된 파동 전환 투자 분석 리포트 V3 🔥
═══════════════════════════════════════════════════════════
📅 생성 시간: {current_time}
🌍 시장 상태: {self.market_regime}
═══════════════════════════════════════════════════════════

📊 === 종합 분석 결과 ===
• 전환 감지 종목: {total_count:,}개
• 평균 투자 점수: {avg_score:.1f}점
• 평균 리스크조정 점수: {avg_risk_adj:.1f}점
• 매수 신호 종목: {buy_count}개
• 최고 점수: {final_results['final_investment_score'].max():.1f}점

📈 === 투자 등급 분포 ==="""

        for grade, count in grade_dist.items():
            pct = count / total_count * 100
            bar = "█" * int(pct / 2)
            report += f"\n{grade:<20} {count:>3}개 ({pct:>5.1f}%) {bar}"

        report += f"\n\n💼 === 투자 카테고리 분포 ==="
        for cat, count in category_dist.head(5).items():
            pct = count / total_count * 100
            report += f"\n{cat:<20} {count:>3}개 ({pct:>5.1f}%)"

        report += f"\n\n🌊 === 파동 단계 분포 ==="
        for wave, count in wave_dist.items():
            pct = count / total_count * 100
            report += f"\n{wave:<20} {count:>3}개 ({pct:>5.1f}%)"

        report += f"\n{sector_report}"

        report += f"""

⭐ === TOP 20 투자 기회 ===
───────────────────────────────────────────────────────────"""

        # 상위 20개 종목 상세 정보
        for idx, row in final_results.head(20).iterrows():
            ticker = row['ticker']
            name = row.get('name', ticker)
            
            # 점수 정보
            final_score = row['final_investment_score']
            risk_adj_score = row['risk_adjusted_score']
            grade = row['investment_grade']
            category = row['investment_category']
            wave = row['wave_stage']
            
            # 가격 정보
            price = row.get('current_price', 0)
            change_20d = row.get('price_change_20d', 0) * 100
            change_6m = row.get('price_change_6m', 0) * 100
            ratio_52w = row.get('ratio_52w', 0) * 100
            volume_ratio = row.get('transition_volume_ratio', 1)
            
            # 펀더멘털
            pe = row.get('pe_ratio', 0)
            pb = row.get('pb_ratio', 0)
            roe = row.get('roe', 0)
            div_yield = row.get('dividend_yield', 0)
            
            # 수급
            inst_ratio = row.get('institutional_ratio_20d', 0)
            foreign_ratio = row.get('foreign_ratio_20d', 0)
            
            # 포지션 크기
            position = row.get('position_size', 0)
            
            report += f"""

【{row['rank']:02d}】 {ticker} | {name}
├─ 등급: {grade} | {category}
├─ 점수: 종합 {final_score:.1f} | 리스크조정 {risk_adj_score:.1f}
├─ 파동: {wave} | 52주 위치: {ratio_52w:.0f}%
├─ 가격: {price:,.0f}원 | 20일: {change_20d:+.1f}% | 6개월: {change_6m:+.1f}%
├─ 거래: {volume_ratio:.1f}배 | 포지션: {position:.1f}
├─ 가치: PER {pe:.1f} | PBR {pb:.1f} | ROE {roe:.1f}% | 배당 {div_yield:.1f}%
└─ 수급: 기관 {inst_ratio:+.1f}% | 외인 {foreign_ratio:+.1f}%"""

        # 투자 전략 가이드
        report += f"""

═══════════════════════════════════════════════════════════
                    💡 투자 전략 가이드 💡
═══════════════════════════════════════════════════════════

🎯 현재 시장 상태: {self.market_regime}
"""
        
        if self.market_regime == "RISK_ON":
            report += """
📈 상승장 전략 (Risk-On)
• 투자 비중: 80-90%
• 매수 기준: 70점 이상
• 손절 라인: -5%
• 목표 수익: +15-25%
• 추천 섹터: 성장주, 기술주, 경기민감주
• 주의사항: 과열 신호 모니터링, 적절한 이익실현
"""
        elif self.market_regime == "RISK_OFF":
            report += """
📉 하락장 전략 (Risk-Off)
• 투자 비중: 30-50%
• 매수 기준: 85점 이상 (엄격)
• 손절 라인: -3%
• 목표 수익: +10-15%
• 추천 섹터: 방어주, 배당주, 필수소비재
• 주의사항: 현금 비중 확대, 분할 매수
"""
        else:
            report += """
⚖️ 중립장 전략 (Neutral)
• 투자 비중: 60-70%
• 매수 기준: 75점 이상
• 손절 라인: -5%
• 목표 수익: +10-20%
• 추천 섹터: 균형 포트폴리오
• 주의사항: 시장 방향성 확인 후 대응
"""

        report += """
📋 파동 단계별 매매 전략
• 2단계 중기: 보유 비중 확대, 추세 추종
• 2단계 초기: 분할 매수, 돌파 확인
• 1→2단계 전환: 소량 진입, 신중한 관찰
• 상승추세: 단기 매매, 빠른 손절

⚠️ 리스크 관리 원칙
1. 개별 종목 최대 10% 제한
2. 손절매 철저히 준수
3. 분산 투자 (최소 5개 이상)
4. 정기적 리밸런싱
5. 감정적 매매 금지

📌 면책 조항
• 본 분석은 투자 참고자료이며, 투자 결정과 그 결과에 대한 
  모든 책임은 투자자 본인에게 있습니다.
• 과거 성과가 미래 수익을 보장하지 않습니다.
• 개인의 투자 성향과 재무 상황을 고려하여 투자하시기 바랍니다.

═══════════════════════════════════════════════════════════
"""
        
        return report

    def generate_enhanced_report_md(self, final_results: pd.DataFrame) -> str:
        """향상된 투자 리포트 생성 (Markdown 버전)"""
        if final_results.empty:
            return "❌ 분석 결과가 없습니다."
        
        # 통계 계산
        total_count = len(final_results)
        avg_score = final_results['final_investment_score'].mean()
        avg_risk_adj = final_results['risk_adjusted_score'].mean()
        
        # 매수 신호 종목
        buy_signals = final_results[final_results.get('final_signal', False)]
        buy_count = len(buy_signals)
        
        # 현재 시간
        current_time = datetime.now().strftime('%Y-%m-%d %H:%M:%S')
        
        report = f"""# 🔥 향상된 파동 전환 투자 분석 리포트 V3

**📅 생성 시간:** {current_time}  
**🌍 시장 상태:** {self.market_regime}

---

## 📊 종합 분석 결과
| 항목 | 값 |
|---|---|
| **전환 감지 종목** | {total_count:,}개 |
| **평균 투자 점수** | {avg_score:.1f}점 |
| **평균 리스크조정 점수** | {avg_risk_adj:.1f}점 |
| **매수 신호 종목** | {buy_count}개 |
| **최고 점수** | {final_results['final_investment_score'].max():.1f}점 |

---

## ⭐ TOP 20 투자 기회

| 순위 | 종목명 | 티커 | 등급 | 점수 | 현재가 | 20일 등락 | 수급(기/외) |
|---|---|---|---|---|---|---|---|
"""

        # 상위 20개 종목 상세 정보
        for idx, row in final_results.head(20).iterrows():
            ticker = row['ticker']
            name = row.get('name', ticker)
            
            # 점수 정보
            final_score = row['final_investment_score']
            grade = row['investment_grade']
            
            # 가격 정보
            price = row.get('current_price', 0)
            change_20d = row.get('price_change_20d', 0) * 100
            
            # 수급
            inst_ratio = row.get('institutional_ratio_20d', 0)
            foreign_ratio = row.get('foreign_ratio_20d', 0)
            
            report += f"| {row['rank']} | **{name}** | `{ticker}` | {grade} | **{final_score:.1f}** | {price:,.0f}원 | {change_20d:+.1f}% | {inst_ratio:+.1f}% / {foreign_ratio:+.1f}% |\n"

        report += """
---

## 💡 투자 전략 가이드

### 1. S급 (90점 이상)
*   **강력 매수 추천**: 즉시 포트폴리오 편입 고려
*   **비중**: 종목당 10~15%
*   **전략**: 눌림목 매수보다는 적극적인 진입 유효

### 2. A급 (80~90점)
*   **매수 추천**: 긍정적인 흐름, 분할 매수 접근
*   **비중**: 종목당 5~10%
*   **전략**: 5일선 지지 확인 후 진입

### 3. B급 (70~80점)
*   **관심 종목**: 추세 전환 초기 단계 가능성
*   **비중**: 종목당 3~5%
*   **전략**: 거래량 실린 양봉 발생 시 진입

---
*본 리포트는 자동화된 알고리즘에 의해 생성되었으며, 투자의 책임은 전적으로 투자자 본인에게 있습니다.*
"""
        return report

    def save_recommendation_history(self, final_results: pd.DataFrame):
        """추천 이력 저장"""
        try:
            # 매수 신호가 있거나 점수가 높은 종목 필터링 (70점 이상)
            recommendations = final_results[
                (final_results.get('final_signal', False)) | 
                (final_results['final_investment_score'] >= 70)
            ].copy()
            
            if recommendations.empty:
                return

            history_file = os.path.join(self.data_dir, 'recommendation_history.csv')
            
            # 저장할 컬럼 선택
            save_cols = [
                'ticker', 'name', 'final_investment_score', 'risk_adjusted_score',
                'investment_grade', 'current_price', 'wave_stage'
            ]
            
            # 존재하는 컬럼만 선택
            valid_cols = [col for col in save_cols if col in recommendations.columns]
            save_df = recommendations[valid_cols].copy()
            
            # 추천 날짜 추가 (오늘)
            today = datetime.now().strftime('%Y-%m-%d')
            save_df['recommendation_date'] = today
            
            # 기존 이력 로드
            if os.path.exists(history_file):
                existing_history = pd.read_csv(history_file, dtype={'ticker': str})
                # 같은 날짜, 같은 종목 중복 제거 (덮어쓰기)
                existing_history = existing_history[
                    ~((existing_history['recommendation_date'] == today) & 
                      (existing_history['ticker'].isin(save_df['ticker'])))
                ]
                final_history = pd.concat([existing_history, save_df])
            else:
                final_history = save_df
            
            # 날짜순 정렬
            final_history = final_history.sort_values(['recommendation_date', 'final_investment_score'], ascending=[True, False])
            
            final_history.to_csv(history_file, index=False, encoding='utf-8-sig')
            logger.info(f"💾 추천 이력 저장 완료: {len(save_df)}개 종목 추가 ({history_file})")
            
        except Exception as e:
            logger.error(f"❌ 추천 이력 저장 실패: {e}")

    def run_complete_analysis(self) -> Tuple[pd.DataFrame, str]:
        """전체 분석 프로세스 실행"""
        logger.info("🚀 파동 전환 분석 시작...")
        
        try:
            # 1. 시장 레짐 확인
            self.check_market_regime()
            
            # 2. 가격 데이터 로딩
            price_data = self.load_real_price_data()
            
            # 3. 파동 전환 종목 탐지
            transition_stocks = self.detect_wave_transitions_real_data(price_data)
            
            if transition_stocks.empty:
                logger.warning("⚠️ 전환 종목이 발견되지 않았습니다")
                return pd.DataFrame(), "전환 조건을 만족하는 종목이 없습니다."
            
            # 4. 펀더멘털 데이터 수집
            fundamental_data = self.collect_korean_fundamental_data(
                transition_stocks['ticker'].tolist()
            )
            
            # 5. 펀더멘털 점수 계산
            if not fundamental_data.empty:
                fundamental_data = self.calculate_fundamental_scores(fundamental_data)
            
            # 6. 기관/외국인 수급 분석
            supply_demand_data = self.analyze_institutional_supply_demand(
                transition_stocks['ticker'].tolist()
            )
            
            # 7. 데이터 통합
            merged_results = transition_stocks.copy()
            
            # 펀더멘털 데이터 병합
            if not fundamental_data.empty:
                # 중복 컬럼 제거
                overlap_cols = set(merged_results.columns) & set(fundamental_data.columns) - {'ticker'}
                if overlap_cols:
                    fundamental_data = fundamental_data.drop(columns=list(overlap_cols))
                merged_results = merged_results.merge(
                    fundamental_data, on='ticker', how='left'
                )
            
            # 수급 데이터 병합
            if not supply_demand_data.empty:
                overlap_cols = set(merged_results.columns) & set(supply_demand_data.columns) - {'ticker'}
                if overlap_cols:
                    supply_demand_data = supply_demand_data.drop(columns=list(overlap_cols))
                merged_results = merged_results.merge(
                    supply_demand_data, on='ticker', how='left'
                )
            
            # 8. 최종 투자 점수 계산
            final_results = self.calculate_final_investment_scores(merged_results)
            
            # 9. 결과 저장
            output_file = os.path.join(self.data_dir, 'wave_transition_analysis_results.csv')
            final_results.to_csv(output_file, index=False, encoding='utf-8-sig')
            logger.info(f"✅ 분석 결과 저장: {output_file}")
            
            # 10. 리포트 생성
            report = self.generate_enhanced_report_v3(final_results)
            
            # 10-2. 마크다운 리포트 생성 및 저장
            report_md = self.generate_enhanced_report_md(final_results)
            md_file = os.path.join(self.data_dir, 'wave_transition_report.md')
            with open(md_file, 'w', encoding='utf-8') as f:
                f.write(report_md)
            logger.info(f"✅ 마크다운 리포트 저장: {md_file}")
            
            # 11. 추천 이력 저장
            self.save_recommendation_history(final_results)
            
            # 12. 분석 완료 통계
            logger.info("✅ 분석 완료!")
            logger.info(f"   총 {len(final_results)}개 종목 분석")
            logger.info(f"   S급: {len(final_results[final_results['investment_grade'].str.contains('S급')])}개")
            logger.info(f"   A급: {len(final_results[final_results['investment_grade'].str.contains('A급')])}개")
            logger.info(f"   매수신호: {len(final_results[final_results.get('final_signal', False)])}개")
            
            return final_results, report
            
        except Exception as e:
            logger.error(f"❌ 분석 중 오류 발생: {e}", exc_info=True)
            return pd.DataFrame(), f"분석 중 오류가 발생했습니다: {str(e)}"


def main():
    """메인 실행 함수"""
    try:
        # 분석기 초기화
        analyzer = EnhancedWaveTransitionAnalyzerV3()
        
        # 전체 분석 실행
        results, report = analyzer.run_complete_analysis()
        
        # 결과 출력
        if not results.empty:
            print(report)
            
            # 리포트 파일 저장
            report_file = os.path.join(analyzer.data_dir, 'wave_transition_report.txt')
            with open(report_file, 'w', encoding='utf-8') as f:
                f.write(report)
            print(f"\n📄 리포트 저장: {report_file}")
            
        else:
            print("❌ 분석 결과가 없습니다.")
            
    except Exception as e:
        logger.error(f"❌ 프로그램 실행 오류: {e}", exc_info=True)
        print(f"\n❌ 오류 발생: {e}")
        print("자세한 내용은 로그를 확인하세요.")


if __name__ == "__main__":
    main()