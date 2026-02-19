"""
시그널 생성기 (Main Engine)
- Collector로부터 데이터 수집
- Scorer로 점수 계산
- PositionSizer로 자금 관리
- 최종 Signal 생성
"""

import asyncio
from datetime import date, datetime, timedelta
from typing import List, Optional, Dict
import os
import sys
import time
from dotenv import load_dotenv
load_dotenv(override=True)

# 모듈 경로 추가 (패키지 인식 문제 해결용)
# 현재: engine/generator.py -> 부모: engine -> 부모: closing_bet (Root)
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from engine.config import SignalConfig, Grade
from engine.models import (
    StockData, Signal, SignalStatus, 
    ScoreDetail, ChecklistDetail, ScreenerResult, ChartData
)
from engine.collectors import KRXCollector, EnhancedNewsCollector
from engine.scorer import Scorer
from engine.position_sizer import PositionSizer
from engine.llm_analyzer import LLMAnalyzer, ClaudeScreener


class SignalGenerator:
    """종가베팅 시그널 생성기 (v2)"""
    
    def __init__(
        self,
        config: SignalConfig = None,
        capital: float = 10_000_000,
    ):
        """
        Args:
            capital: 총 자본금 (기본 5천만원)
            config: 설정 (기본 설정 사용)
        """
        self.config = config or SignalConfig()
        self.capital = capital
        
        self.scorer = Scorer(self.config)
        self.position_sizer = PositionSizer(capital, self.config)
        self.llm_analyzer = LLMAnalyzer() # API Key from env
        
        self._collector: Optional[KRXCollector] = None
        self._news: Optional[EnhancedNewsCollector] = None
    
    async def __aenter__(self):
        self._collector = KRXCollector(self.config)
        await self._collector.__aenter__()
        
        self._news = EnhancedNewsCollector(self.config)
        await self._news.__aenter__()
        return self
    
    async def __aexit__(self, exc_type, exc_val, exc_tb):
        if self._collector:
            await self._collector.__aexit__(exc_type, exc_val, exc_tb)
        if self._news:
            await self._news.__aexit__(exc_type, exc_val, exc_tb)
    
    async def generate(
        self,
        target_date: date = None,
        markets: List[str] = None,
        top_n: int = 30,
    ) -> List[Signal]:
        """
        시그널 생성
        
        Args:
            target_date: 대상 날짜 (기본: 오늘)
            markets: 대상 시장 (기본: KOSPI, KOSDAQ)
            top_n: 상승률 상위 N개 종목
        
        Returns:
            Signal 리스트 (등급순 정렬)
        """
        target_date = target_date or date.today()
        # markets = markets or ["KOSPI", "KOSDAQ"]
        markets = markets or ["KOSPI", "KOSDAQ"] 
        
        all_signals = []
        
        for market in markets:
            print(f"\n[{market}] 상승률 상위 종목 스크리닝...")
            
            # 1. 상승률 상위 종목 조회
            candidates = await self._collector.get_top_gainers(market, top_n)
            print(f"  - 1차 필터 통과: {len(candidates)}개")
            
            # 2. 각 종목 분석
            for i, stock in enumerate(candidates):
                print(f"  [{i+1}/{len(candidates)}] {stock.name}({stock.code}) 분석 중...", end='\r')
                
                signal = await self._analyze_stock(stock, target_date)
                
                if signal and signal.grade in (Grade.S, Grade.A):
                    all_signals.append(signal)
                    print(f"\n    ✅ {stock.name}: {signal.grade.value}급 시그널 생성! (점수: {signal.score.total})")
                
                # Rate limiting
                # await asyncio.sleep(0.1) # 너무 느려지면 제거
        
        # 3. 등급순 정렬 (S > A > B)
        grade_order = {Grade.S: 0, Grade.A: 1, Grade.B: 2, Grade.C: 3}
        all_signals.sort(key=lambda s: (grade_order[s.grade], -s.score.total))
        
        # 4. 최대 포지션 수 제한
        if len(all_signals) > self.config.max_positions:
            all_signals = all_signals[:self.config.max_positions]
        
        print(f"\n총 {len(all_signals)}개 시그널 생성 완료")
        return all_signals
    
    async def _analyze_stock(
        self,
        stock: StockData,
        target_date: date
    ) -> Optional[Signal]:
        """개별 종목 분석"""
        try:
            # 1. 상세 정보 조회 (이미 top_gainers에서 대부분 가져왔으나 52주 고가 등 보완)
            detail = await self._collector.get_stock_detail(stock.code)
            if detail:
                # 병합 로직 (필요한 정보만 업데이트)
                stock.high_52w = detail.high_52w
            
            # 2. 차트 데이터 조회
            charts = await self._collector.get_chart_data(stock.code, 60)
            
            # 3. 뉴스 조회 (본문 포함, 종목명 전달)
            # EnhancedNewsCollector: get_stock_news(code, limit, name)
            try:
                news_list = await self._news.get_stock_news(stock.code, 3, stock.name)
            except Exception as e:
                print(f"    ⚠ News fetch failed ({type(e).__name__}): {e}")
                news_list = []
            print(f"    -> News fetched: {len(news_list)}")
            
            # 4. LLM 뉴스 분석 (Rate Limit 방지 Sleep)
            llm_result = None
            if news_list and self.llm_analyzer.model:
                # Gemini Rate Limit 방지 (3.0 유료 모델 테스트: 2초)
                await asyncio.sleep(2)
                
                print(f"    [LLM] Analyzing {stock.name} news...")
                news_dicts = [{"title": n.title, "summary": n.summary} for n in news_list]
                llm_result = await self.llm_analyzer.analyze_news_sentiment(stock.name, news_dicts)
                if llm_result:
                   print(f"      -> Score: {llm_result.get('score')}, Reason: {llm_result.get('reason')}")

            # 5. 수급 데이터 조회 (CSV에서 로드, 5일 누적)
            supply = await self._collector.get_supply_data(stock.code)
            if supply:
                print(f"      -> Supply 5d: Foreign {supply.foreign_buy_5d}, Inst {supply.inst_buy_5d}")
            
            # 6. 점수 계산 (LLM 결과 반영)
            score, checklist = self.scorer.calculate(stock, charts, news_list, supply, llm_result)
            
            # 7. 등급 결정
            grade = self.scorer.determine_grade(stock, score)
            
            # C등급은 제외
            if grade == Grade.C:
                print(f"    ❌ 탈락 {stock.name}: 점수 {score.total} (뉴스{score.news}, 수급{score.supply}, 거래대금{score.volume}, 차트{score.chart})")
                return None
            
            # 7. 포지션 계산
            position = self.position_sizer.calculate(stock.close, grade)
            
            # 8. 시그널 생성
            signal = Signal(
                stock_code=stock.code,
                stock_name=stock.name,
                market=stock.market,
                sector=stock.sector,
                signal_date=target_date,
                signal_time=datetime.now(),
                grade=grade,
                score=score,
                checklist=checklist,
                news_items=[{
                    "title": n.title,
                    "source": n.source,
                    "published_at": n.published_at.isoformat() if n.published_at else "",
                    "url": n.url
                } for n in news_list[:5]], # 상위 5개 뉴스 저장
                current_price=stock.close,
                entry_price=position.entry_price,
                stop_price=position.stop_price,
                target_price=position.target_price,
                r_value=position.r_value,
                position_size=position.position_size,
                quantity=position.quantity,
                r_multiplier=position.r_multiplier,
                trading_value=stock.trading_value,
                change_pct=stock.change_pct,
                foreign_5d=supply.foreign_buy_5d if supply else 0,
                inst_5d=supply.inst_buy_5d if supply else 0,
                status=SignalStatus.PENDING,
                created_at=datetime.now(),
                themes=llm_result.get("themes", []) if llm_result else [],
            )
            
            return signal
            
        except Exception as e:
            # print(f"    분석 실패: {e}")
            return None
    
    def get_summary(self, signals: List[Signal]) -> Dict:
        """시그널 요약 정보"""
        summary = {
            "total": len(signals),
            "by_grade": {g.value: 0 for g in Grade},
            "by_market": {},
            "total_position": 0,
            "total_risk": 0,
        }
        
        for s in signals:
            summary["by_grade"][s.grade.value] += 1
            summary["by_market"][s.market] = summary["by_market"].get(s.market, 0) + 1
            summary["total_position"] += s.position_size
            summary["total_risk"] += s.r_value * s.r_multiplier
        
        return summary


async def run_screener(
    capital: float = 50_000_000,
    markets: List[str] = None,
    target_date: date = None,
) -> ScreenerResult:
    """
    스크리너 실행 (간편 함수)
    """
    import sys
    
    print("🚀 Jongga V2 스크리너 시작...", flush=True)
    start_time = time.time()
    
    # target_date가 없으면 오늘
    target_date = target_date or date.today()
    
    async with SignalGenerator(capital=capital) as generator:
        print(f"📊 시장 분석 중... (자본금: {capital:,}원, 기준일: {target_date})", flush=True)
        signals = await generator.generate(markets=markets, target_date=target_date)
        print(f"✅ {len(signals)}개 시그널 생성됨", flush=True)
        summary = generator.get_summary(signals)
    
    processing_time = (time.time() - start_time) * 1000
    
    result = ScreenerResult(
        date=date.today(),
        total_candidates=summary["total"],
        filtered_count=len(signals),
        signals=signals,
        by_grade=summary["by_grade"],
        by_market=summary["by_market"],
        processing_time_ms=processing_time,
    )
    
    # Claude AI 독립 종목 스크리닝
    claude_picks = {}
    try:
        screener = ClaudeScreener()
        if screener.client:
            print("🤖 Claude AI 독립 스크리닝 시작...", flush=True)
            signals_data = [s.to_dict() for s in signals]
            claude_picks = await screener.screen_candidates(signals_data)
            pick_count = len(claude_picks.get("picks", []))
            print(f"✅ Claude AI {pick_count}개 종목 선별 완료", flush=True)
        else:
            print("⚠ Claude API Key 미설정 - 독립 스크리닝 스킵", flush=True)
    except Exception as e:
        print(f"⚠ Claude Screener failed: {e}", flush=True)
        claude_picks = {"picks": [], "error": str(e)}

    # 결과 저장
    print("💾 결과 저장 중...", flush=True)
    save_result_to_json(result, claude_picks=claude_picks)
    
    print(f"🎉 완료! ({processing_time/1000:.1f}초 소요)", flush=True)
    
    return result

async def analyze_single_stock_by_code(
    code: str,
    capital: float = 50_000_000,
) -> Optional[Signal]:
    """
    단일 종목 재분석 및 결과 JSON 업데이트
    """
    async with SignalGenerator(capital=capital) as generator:
        # 1. 기본 상세 정보 조회 (StockData 구성)
        detail = await generator._collector.get_stock_detail(code)
        if not detail:
            print(f"Stock detail not found for {code}")
            return None
            
        # StockData 객체 임시 생성 (Collector의 convert 로직 일부 활용 필요하지만, 여기선 detail로 구성)
        # KRXCollector 내부에 get_stock_data 같은게 없으므로, get_stock_detail 결과로 StockData를 수동 구성해야 함.
        # 하지만 top_gainers를 안 거치므로, 기본 등락률 등의 정보가 부족할 수 있음.
        # 따라서, get_quote 등을 통해 현재가 정보를 가져와야 함.
        
        # 간편하게: get_ticker_listing -> pykrx 등 활용 또는 collector에 메서드 추가가 정석이나,
        # 여기서는 existing json에서 해당 종목 정보를 읽어와서 StockData로 복원하는게 안전함.
        
        # 1-1. 최신 JSON 로드 (이전 데이터 기반)
        import json
        base_dir = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "data")
        latest_path = os.path.join(base_dir, "jongga_v2_latest.json")
        
        if not os.path.exists(latest_path):
            print("Latest data file not found.")
            return None
            
        with open(latest_path, "r", encoding="utf-8") as f:
            data = json.load(f)
            
        target_signal_data = next((s for s in data["signals"] if s["stock_code"] == code), None)
        
        if not target_signal_data:
            print("Signal not found in latest data. Cannot re-analyze without base info.")
            return None
            
        # StockData 복원
        stock = StockData(
            code=target_signal_data.get("stock_code", code),
            name=target_signal_data.get("stock_name", ""),
            market=target_signal_data.get("market", "KOSPI"),
            sector=target_signal_data.get("sector", ""),
            close=target_signal_data.get("current_price", target_signal_data.get("entry_price", 0)),
            change_pct=target_signal_data.get("change_pct", 0),
            trading_value=target_signal_data.get("trading_value", 0),
            volume=0, 
            marcap=0  
        )
        
        # 2. 재분석 실행
        print(f"Re-analyzing {stock.name} ({stock.code})...")
        new_signal = await generator._analyze_stock(stock, date.today())
        
        if new_signal:
            print(f"✅ Re-analysis complete: {new_signal.grade.value} (Score: {new_signal.score.total})")
            
            # 3. JSON 데이터 업데이트 및 저장
            # 기존 signals 리스트에서 해당 종목 교체
            updated_signals = [
                new_signal.to_dict() if s["stock_code"] == code else s 
                for s in data["signals"]
            ]
            
            data["signals"] = updated_signals
            data["updated_at"] = datetime.now().isoformat() # 전체 업데이트 시간 갱신
            
            # 파일 저장
            # 1) Latest
            with open(latest_path, "w", encoding="utf-8") as f:
                json.dump(data, f, indent=2, ensure_ascii=False)
                
            # 2) Daily (오늘 날짜)
            date_str = date.today().strftime("%Y%m%d")
            daily_path = os.path.join(base_dir, f"jongga_v2_results_{date_str}.json")
            if os.path.exists(daily_path):
                 with open(daily_path, "w", encoding="utf-8") as f:
                    json.dump(data, f, indent=2, ensure_ascii=False)
            
            return new_signal
            
        else:
            print("Re-analysis failed or grade too low.")
            return None

def save_result_to_json(result: ScreenerResult, claude_picks: dict = None):
    """결과 JSON 저장 (Daily + Latest)"""
    import json
    import shutil

    data = {
        "date": result.date.isoformat(),
        "total_candidates": result.total_candidates,
        "filtered_count": result.filtered_count,
        "signals": [s.to_dict() for s in result.signals],
        "by_grade": result.by_grade,
        "by_market": result.by_market,
        "processing_time_ms": result.processing_time_ms,
        "updated_at": datetime.now().isoformat(),
        "claude_picks": claude_picks or {}
    }
    
    # 1. 날짜별 파일 저장
    date_str = result.date.strftime("%Y%m%d")
    filename = f"jongga_v2_results_{date_str}.json"
    
    base_dir = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "data")
    os.makedirs(base_dir, exist_ok=True)
    
    save_path = os.path.join(base_dir, filename)
    
    with open(save_path, "w", encoding="utf-8") as f:
        json.dump(data, f, indent=2, ensure_ascii=False)
    
    print(f"\n[저장 완료] Daily: {save_path}")
    
    # 2. Latest 파일 업데이트 (덮어쓰기)
    latest_path = os.path.join(base_dir, "jongga_v2_latest.json")
    with open(latest_path, "w", encoding="utf-8") as f:
        json.dump(data, f, indent=2, ensure_ascii=False)
        
    print(f"[저장 완료] Latest: {latest_path}")


# 테스트용 메인
async def main():
    """테스트 실행"""
    print("=" * 60)
    print("종가베팅 시그널 생성기 v2 (Live Entity)")
    print("=" * 60)
    
    capital = 50_000_000
    print(f"\n자본금: {capital:,}원")
    print(f"R값: {capital * 0.005:,.0f}원 (0.5%)")
    
    result = await run_screener(capital=capital)
    
    print(f"\n처리 시간: {result.processing_time_ms:.0f}ms")
    print(f"생성된 시그널: {len(result.signals)}개")
    print(f"등급별: {result.by_grade}")
    
    print("\n" + "=" * 60)
    print("시그널 상세")
    print("=" * 60)
    
    for i, signal in enumerate(result.signals, 1):
        print(f"\n[{i}] {signal.stock_name} ({signal.stock_code})")
        print(f"    등급: {signal.grade.value}")
        print(f"    점수: {signal.score.total}/12 (뉴스:{signal.score.news}, 수급:{signal.score.supply}, 차트:{signal.score.chart})")
        print(f"    등락률: {signal.change_pct:+.2f}%")
        print(f"    거래대금: {signal.trading_value / 100_000_000:,.0f}억")
        print(f"    진입가: {signal.entry_price:,}원")
        print(f"    손절가: {signal.stop_price:,}원 (-3%)")
        print(f"    목표가: {signal.target_price:,}원 (+5%)")
        print(f"    수량: {signal.quantity:,}주")
        print(f"    포지션: {signal.position_size:,.0f}원")
        
        # 체크리스트 출력
        print("    [체크리스트]")
        check = signal.checklist
        print(f"     - 뉴스: {'O' if check.has_news else 'X'} {check.news_sources}")
        print(f"     - 신고가/돌파: {'O' if check.is_new_high or check.is_breakout else 'X'}")
        print(f"     - 수급: {'O' if check.supply_positive else 'X'}")

if __name__ == "__main__":
    try:
        asyncio.run(main())
    except KeyboardInterrupt:
        print("\n중단됨")
