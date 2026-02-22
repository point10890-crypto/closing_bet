# KR Market Package - Claude Code 자율 운영 가이드
# v2.4.0 (Final Clean Structure + All Dead Code Archived)

## 1. 환경 설정 (절대 고정 - 변경 금지)

### 경로 변수 (모든 Bash 명령어에서 반드시 선언 후 사용)
```bash
PROJECT="/c/closing_bet"
PYTHON="$PROJECT/.venv/Scripts/python.exe"
FRONTEND="$PROJECT/frontend"
```

### 절대 규칙
1. **경로**: Windows 경로(`C:\...`) 사용 금지 → 항상 MINGW 경로: `/c/closing_bet`
2. **Python 실행**: 반드시 `"$PYTHON"` 변수 사용. `python`, `py` 직접 사용 금지
3. **인코딩**: Python 실행 시 `PYTHONIOENCODING=utf-8` 환경변수 필수 (cp949 에러 방지)
4. **작업 디렉토리**: 명령어 실행 전 반드시 `cd "$PROJECT"` 선행
5. **따옴표**: 모든 경로 변수는 큰따옴표(`"`)로 감싸기
6. **백그라운드**: 서버는 `&`로 백그라운드 실행 후 포트 확인

### 서버 관리
| 서비스 | 포트 | 시작 명령 |
|--------|------|----------|
| Flask API | 5001 | `cd "$PROJECT" && "$PYTHON" flask_app.py &` |
| Next.js | 4000 | `cd "$FRONTEND" && npm start &` |
| Scheduler | - | `cd "$PROJECT" && PYTHONIOENCODING=utf-8 "$PYTHON" scheduler.py --daemon &` |

```bash
# 포트 확인
netstat -ano | grep -E "5001|4000"
# 프로세스 종료
netstat -ano | grep 5001 | awk '{print $5}' | sort -u | xargs -I{} taskkill //F //PID {} 2>/dev/null
netstat -ano | grep 4000 | awk '{print $5}' | sort -u | xargs -I{} taskkill //F //PID {} 2>/dev/null
```

---

## 2. 프로젝트 아키텍처 (최적화 완료)

### 디렉토리 구조
```
/c/closing_bet/
├── flask_app.py              # Flask API 진입점 (포트 5001)
├── scheduler.py              # 통합 스케줄러 (US/KR/Crypto, 고정경로)
├── market_gate.py            # 시장 레짐 감지 (RISK_ON/OFF/NEUTRAL)
├── config.py                 # 루트 설정 (ScreenerConfig, MarketGateConfig, BacktestConfig)
├── models.py                 # 루트 모델 (StockInfo, Trade, Signal - scheduler/backtest용)
├── all_institutional_trend_data.py  # 기관 수급 데이터 수집 (scheduler 호출)
├── signal_tracker.py         # VCP 시그널 추적 (scheduler 호출)
├── update_us.py              # US 마켓 데이터 파이프라인 (scheduler 호출)
├── .env                      # API 키 관리
│
├── engine/                   # === 종가베팅 V2 핵심 엔진 ===
│   ├── config.py             # V2 설정 (SignalConfig, Grade, 점수 가중치 14점)
│   ├── models.py             # V2 모델 (Signal, ScoreDetail, ChecklistDetail)
│   ├── collectors.py         # 데이터 수집 (KRXCollector, EnhancedNewsCollector)
│   ├── dart_collector.py     # OpenDART 호재공시 수집기
│   ├── llm_analyzer.py       # LLM 분석 + Multi-AI Consensus (Gemini+GPT-4o)
│   ├── scorer.py             # 점수 계산기 (14점 만점, DART 포함)
│   ├── position_sizer.py     # R 기반 포지션 사이징
│   └── generator.py          # 시그널 생성 메인 엔진 (run_screener)
│
├── app/                      # Flask Blueprint 앱
│   ├── __init__.py           # create_app() 팩토리
│   ├── routes/
│   │   ├── kr_market.py      # KR API (/api/kr/*) — DATA_DIR 고정경로
│   │   ├── us_market.py      # US API (/api/us/*)
│   │   ├── stock_analyzer.py # ProPicks API (/api/stock-analyzer/*)
│   │   ├── main.py           # 메인 라우트
│   │   └── auth.py           # 인증 API
│   └── utils/
│       ├── cache.py          # 파일 캐시 유틸
│       └── scheduler.py      # 앱 내 가격갱신 스케줄러 (V2 연동, 고정경로)
│
├── app.py                    # Stock Analyzer 단독 웹앱 (포트 5000)
├── stock_info.py             # 일괄 스크래핑 스크립트
├── stock_data.xlsx           # 종목 목록 2,500건
├── templates/index.html      # 단독 웹 UI
│
├── frontend/                 # Next.js 14 대시보드
│   └── src/
│       ├── app/dashboard/
│       │   ├── kr/closing-bet/page.tsx      # 종가베팅 대시보드
│       │   └── stock-analyzer/page.tsx      # ProPicks 분석 전용 페이지
│       └── components/layout/
│           ├── Header.tsx         # ⌘K 단축키 + CommandPalette
│           ├── Sidebar.tsx        # 사이드바 (ProPicks 포함)
│           └── CommandPalette.tsx  # 종목 검색 → 리다이렉트
│
├── data/                     # 데이터 저장소 (실시간)
│   ├── jongga_v2_latest.json      # 최신 종가베팅 결과
│   ├── jongga_v2_results_YYYYMMDD.json  # 날짜별 아카이브
│   ├── dart_corp_codes.json       # DART corp_code 매핑 캐시 (7일)
│   ├── daily_prices.csv           # 일별 가격 데이터
│   └── users.db                   # SQLite 유저 DB
│
├── archive/                  # 레거시 코드 보관 (실행 안됨)
│   └── legacy_v1/            # V1 스크립트, 백업 파일
│
├── backtest/                 # 백테스트 엔진
│   └── engine.py
│
└── chatbot/                  # AI 챗봇 (Gemini 기반)
    ├── core.py
    └── prompts.py
```

### 경로 고정 원칙 (모든 파일에 적용 완료)
| 파일 | 경로 방식 | 기준점 |
|------|----------|--------|
| `kr_market.py` | `DATA_DIR = _BASE_DIR + '/data'` | `__file__` 기반 절대경로 |
| `app/utils/scheduler.py` | `BASE_DIR` / `DATA_DIR` | `__file__` 기반 절대경로 |
| `scheduler.py` | `Config.BASE_DIR` / `Config.DATA_DIR` | `__file__` 기반 + env 오버라이드 |
| `engine/generator.py` | `os.path.dirname(os.path.abspath(__file__))` | 엔진 패키지 기준 |

---

## 3. 종가베팅 V2 엔진 상세

### 실행 파이프라인
```
run_screener(capital=50_000_000)
  │
  ├─ 1. KRXCollector.get_top_gainers() → KOSPI/KOSDAQ 상승률 상위 30종목
  │
  ├─ 2. _analyze_stock() (각 종목별)
  │   ├─ get_stock_detail() → 52주 고가 등 보완
  │   ├─ get_chart_data(60일) → 이동평균, 차트 패턴
  │   ├─ asyncio.gather(뉴스수집, DART공시수집) → 병렬 실행
  │   ├─ LLM 뉴스 분석 (dart_text 포함)
  │   ├─ get_supply_data() → 5일 누적 수급
  │   ├─ Scorer.calculate() → 14점 만점 점수
  │   ├─ determine_grade() → S/A/B/C 등급
  │   └─ PositionSizer.calculate() → R 기반 포지션
  │
  ├─ 3. 등급순 정렬 (S > A > B, C등급 제외)
  │
  ├─ 4. MultiAIConsensusScreener.screen_candidates()
  │   ├─ GeminiScreener (gemini-2.5-flash) ─┐
  │   │                                       ├─ asyncio.gather (60초 타임아웃)
  │   ├─ OpenAIScreener (gpt-4o) ────────────┘
  │   └─ _build_consensus() → 교집합=CONSENSUS(confidence↑), 단독=하향
  │
  └─ 5. save_result_to_json() → data/jongga_v2_latest.json + 날짜별 아카이브
```

### 점수 체계 (14점 만점)
| 항목 | 배점 | 소스 | 설명 |
|------|------|------|------|
| 뉴스/재료 | 0~3 | LLM 분석 or 키워드 | Perplexity→Gemini→Claude→OpenAI→키워드 폴백 |
| 거래대금 | 0~3 | KRX 시세 | 500억↑:3, 100억↑:2, 5억↑:1 |
| 차트패턴 | 0~2 | 일봉 데이터 | 신고가+이평선 정배열 |
| 캔들형태 | 0~1 | 당일 시세 | 장대양봉, 윗꼬리 짧음 |
| 기간조정 | 0~1 | 60일 차트 | 변동성 축소 후 돌파 |
| 수급 | 0~2 | 투자자별 순매수 | 외인+기관 동시매수:2 |
| 공시(DART) | 0~2 | OpenDART API | 자사주/무상증자:2, 배당/합병:1, 악재:-2 |

### 등급 기준
| 등급 | 최소점수 | 최소거래대금 | R배수 |
|------|---------|------------|-------|
| S | 9점 | 500억 | 1.5x |
| A | 7점 | 100억 | 1.0x |
| B | 5점 | 20억 | 0.5x |
| C | - | - | 0 (매매안함) |

---

## 4. 데이터 흐름 (End-to-End)

```
[Engine] run_screener()
    ↓ 저장
[JSON] data/jongga_v2_latest.json
    ↓ 읽기
[Flask] /api/kr/jongga-v2/latest  (kr_market.py → DATA_DIR 고정경로)
    ↓ fetch
[Next.js] page.tsx → ScreenerResult 인터페이스
    ↓ 렌더링
[Dashboard] http://localhost:4000/dashboard/kr/closing-bet
```

### Signal.to_dict() 필드 (백엔드 → 프론트엔드 동기화 완료)
```python
{
    "stock_code", "stock_name", "market", "sector",
    "signal_date", "grade",
    "score": {news, volume, chart, candle, consolidation, supply, disclosure, total, llm_reason, llm_source},
    "checklist": {has_news, news_sources, volume_sufficient, is_new_high, is_breakout, ma_aligned,
                  good_candle, has_consolidation, supply_positive, has_disclosure, disclosure_types,
                  negative_news, upper_wick_long, volume_suspicious},
    "current_price", "entry_price", "stop_price", "target_price",
    "quantity", "position_size", "r_value", "r_multiplier",
    "trading_value", "change_pct", "volume_ratio",
    "foreign_5d", "inst_5d",
    "news_items", "themes"
}
```

---

## 5. API 키 관리 (.env)

| 키 | 용도 | 필수 |
|----|------|------|
| `GEMINI_API_KEY` | Gemini 2.5 Flash 분석 + 스크리닝 | O (핵심) |
| `OPENAI_API_KEY` | GPT-4o 스크리닝 | O (Multi-AI) |
| `PERPLEXITY_API_KEY` | 실시간 뉴스 검색 | 선택 (만료 가능) |
| `ANTHROPIC_API_KEY` | Claude 분석 (현재 비활성) | 선택 |
| `DART_API_KEY` | OpenDART 전자공시 | O (공시 기능) |
| `TELEGRAM_BOT_TOKEN` | 텔레그램 알림 | 선택 |
| `TELEGRAM_CHANNEL_BOT_TOKEN` | 채널 전용 봇 | 선택 |

---

## 6. 프론트엔드 (Next.js)

### 핵심 파일
- `frontend/src/app/dashboard/kr/closing-bet/page.tsx` — 종가베팅 대시보드 메인

### TypeScript 인터페이스 (백엔드 완전 동기화)
```typescript
ScoreDetail  { news, volume, chart, candle, consolidation, supply, disclosure, llm_reason, total }
AIPick       { stock_code, stock_name, rank, confidence, reason, risk, source?, gemini_rank?, openai_rank? }
AIPicks      { picks[], models?, consensus_count?, consensus_method? }
ChecklistDetail { has_news, volume_sufficient, is_new_high, is_breakout, ma_aligned, good_candle,
                  has_consolidation, supply_positive, has_disclosure?, disclosure_types?,
                  negative_news, upper_wick_long, volume_suspicious }
Signal       { stock_code, stock_name, market, sector?, grade, score, checklist,
               current_price, entry_price, stop_price, target_price, quantity?, position_size?,
               r_value?, r_multiplier?, change_pct, trading_value, volume_ratio?,
               foreign_5d, inst_5d, news_items?, themes? }
ScreenerResult { date, total_candidates, filtered_count, signals[], by_grade?, by_market?,
                 processing_time_ms?, updated_at, claude_picks? }
```

### 버전: v2.4.0 (Stock Analyzer Dashboard Integration)

---

## 7. 알려진 이슈 & 해결법

| 이슈 | 원인 | 해결 |
|------|------|------|
| `UnicodeEncodeError: cp949` | Windows 기본 인코딩 | `PYTHONIOENCODING=utf-8` 환경변수 |
| Perplexity 401 Unauthorized | API 키 만료 | LLM 폴백 체인이 Gemini로 자동 전환 |
| Anthropic API 사용불가 | API 크레딧 소진 | Multi-AI Consensus (Gemini+GPT-4o) 로 대체 |
| DART corp_code 첫 실행 느림 | ZIP 다운로드 | 7일 캐시 (`data/dart_corp_codes.json`) |
| 프론트엔드 체크리스트 미표시 | 중첩 vs 플랫 구조 불일치 | `to_dict()` 반드시 플랫 구조 |
| 경로 충돌 `'data/...'` | 상대경로 사용 | 모든 파일 `DATA_DIR` 절대경로 고정 완료 |

---

## 8. 스킬 명령어 (자동 실행)

### 스킬 1: 종가베팅 V2 엔진 실행
```bash
PROJECT="/c/closing_bet"
PYTHON="$PROJECT/.venv/Scripts/python.exe"
cd "$PROJECT" && PYTHONIOENCODING=utf-8 "$PYTHON" -c "
import asyncio
from engine.generator import run_screener
asyncio.run(run_screener(capital=50_000_000))
"
```

### 스킬 2: 서버 전체 재시작
```bash
PROJECT="/c/closing_bet"
PYTHON="$PROJECT/.venv/Scripts/python.exe"
FRONTEND="$PROJECT/frontend"
netstat -ano | grep 5001 | awk '{print $5}' | sort -u | xargs -I{} taskkill //F //PID {} 2>/dev/null
netstat -ano | grep 4000 | awk '{print $5}' | sort -u | xargs -I{} taskkill //F //PID {} 2>/dev/null
sleep 2
cd "$PROJECT" && "$PYTHON" flask_app.py &
sleep 3
cd "$FRONTEND" && npm start &
sleep 5
netstat -ano | grep -E "5001|4000"
```

### 스킬 3: 프론트엔드 빌드 검증
```bash
PROJECT="/c/closing_bet"
cd "$PROJECT/frontend" && npx next build
```

### 스킬 4: 전체 검증 (임포트 + 경로 + 데이터모델)
```bash
PROJECT="/c/closing_bet"
PYTHON="$PROJECT/.venv/Scripts/python.exe"
cd "$PROJECT" && PYTHONIOENCODING=utf-8 "$PYTHON" -c "
from engine.generator import SignalGenerator, run_screener
from engine.llm_analyzer import LLMAnalyzer, MultiAIConsensusScreener
from engine.dart_collector import DARTCollector
from engine.scorer import Scorer
from engine.models import Signal, ScoreDetail, ChecklistDetail
from engine.config import SignalConfig, Grade
print('[1] Engine imports: OK')

from app import create_app
app = create_app()
routes = sorted([r.rule for r in app.url_map.iter_rules() if '/api/kr/' in r.rule])
print(f'[2] Flask app: OK ({len(routes)} KR routes)')

import os
from app.routes.kr_market import DATA_DIR
assert os.path.isdir(DATA_DIR), f'DATA_DIR missing: {DATA_DIR}'
print(f'[3] Path resolution: OK ({DATA_DIR})')

d = Signal().to_dict()
required = ['current_price', 'sector', 'r_multiplier', 'volume_ratio']
missing = [k for k in required if k not in d]
assert not missing, f'Missing: {missing}'
print(f'[4] Signal.to_dict(): OK')

print()
print('ALL CHECKS PASSED')
"
```

### 스킬 5: 최신 결과 확인
```bash
PROJECT="/c/closing_bet"
PYTHON="$PROJECT/.venv/Scripts/python.exe"
cd "$PROJECT" && PYTHONIOENCODING=utf-8 "$PYTHON" -c "
import json
with open('data/jongga_v2_latest.json', 'r', encoding='utf-8') as f:
    d = json.load(f)
print(f'Date: {d[\"date\"]}  Signals: {d.get(\"filtered_count\", len(d.get(\"signals\",[])))}'  )
print(f'By Grade: {d.get(\"by_grade\", {})}')
for s in d['signals']:
    sc = s['score']
    print(f'  {s[\"grade\"]} | {s[\"stock_name\"]:12} | {sc[\"total\"]:2d}/14 | {s[\"change_pct\"]:+.1f}%')
picks = d.get('claude_picks', {})
print(f'AI: {len(picks.get(\"picks\",[]))} picks (Consensus:{picks.get(\"consensus_count\",0)})')
"
```

### 스킬 6: 단일 종목 재분석
```bash
PROJECT="/c/closing_bet"
PYTHON="$PROJECT/.venv/Scripts/python.exe"
STOCK_CODE="005930"
cd "$PROJECT" && PYTHONIOENCODING=utf-8 "$PYTHON" -c "
import asyncio
from engine.generator import analyze_single_stock_by_code
result = asyncio.run(analyze_single_stock_by_code('$STOCK_CODE'))
if result:
    d = result.to_dict()
    print(f'{d[\"stock_name\"]} | {d[\"grade\"]} | Score:{d[\"score\"][\"total\"]}')
else:
    print('Analysis failed or grade C')
"
```

---

## 9. 개발 패턴 & 규칙

### 코드 수정 시 체크리스트
1. **engine/ 수정** → 스킬 4 (전체 검증) → 스킬 1 (엔진 실행)
2. **frontend/ 수정** → 스킬 3 (빌드 검증) → 브라우저 확인
3. **models.py 수정** → `to_dict()` 플랫 구조 유지 → 프론트엔드 TS 인터페이스 동기화
4. **llm_analyzer.py 수정** → `analyze_news(dart_text)` 시그니처 동기화
5. **.env 수정** → 스킬 2 (서버 재시작)

### 비동기 패턴
- 엔진 전체 `async/await` 기반
- 뉴스 + DART 공시: `asyncio.gather(return_exceptions=True)` 병렬
- Multi-AI 스크리닝: `asyncio.gather()` + `wait_for(timeout=60)` 병렬
- KRX 데이터: `asyncio.to_thread()` 동기→비동기 래핑

### JSON 호환성
- `claude_picks` 키 이름 유지 (프론트엔드 하위 호환) — 실제 Multi-AI Consensus
- `jongga_v2_latest.json` + `jongga_v2_results_YYYYMMDD.json` 이중 저장

### 에러 핸들링
- LLM: 폴백 체인 (Perplexity→Gemini→Claude→OpenAI→키워드)
- DART: 실패 시 빈 결과 (점수 0)
- Multi-AI: 한쪽 실패해도 나머지 결과 생성
- 수집기: `return_exceptions=True` 병렬 에러 격리

---

## 10. 스케줄러 실행 (고정 경로)

### 메인 스케줄러 (scheduler.py)
```bash
# 데몬 모드 (전체 스케줄 자동 실행)
cd "$PROJECT" && PYTHONIOENCODING=utf-8 "$PYTHON" scheduler.py --daemon

# 종가베팅 V2만 즉시 실행
cd "$PROJECT" && PYTHONIOENCODING=utf-8 "$PYTHON" scheduler.py --jongga-v2

# 전체 US+KR 즉시 실행
cd "$PROJECT" && PYTHONIOENCODING=utf-8 "$PYTHON" scheduler.py --now
```

### 스케줄 (KST)
| 시간 | 마켓 | 작업 |
|------|------|------|
| 04:00 | US | 전체 데이터 갱신 + Smart Money Top5 |
| 09:30 | US | Track Record 스냅샷 |
| 15:10 | KR | 종가베팅 V2 실행 → S/A급 텔레그램 |
| 16:00 | KR | 가격/수급/VCP/AI/리포트 |
| 매4시간 | Crypto | 전체 파이프라인 |

### 경로 설정
```python
Config.BASE_DIR     = /c/closing_bet          # __file__ 기반
Config.DATA_DIR     = /c/closing_bet/data
Config.PYTHON_PATH  = /c/closing_bet/.venv/Scripts/python.exe  # venv 우선
Config.LOG_DIR      = /c/closing_bet/logs
```

---

## 11. Stock Analyzer / ProPicks (Investing.com 스크래핑)

### 개요
Investing.com ProPicks 분석 결과(적극 매수/매수/중립/매도/적극 매도)를 종목별로 스크래핑하는 도구.
**대시보드 통합 완료** — 사이드바 ProPicks + ⌘K CommandPalette에서 접근 가능.

### 파일 구조
| 파일 | 역할 |
|------|------|
| **대시보드 통합** | |
| `app/routes/stock_analyzer.py` | Blueprint API (search, analyze, export) |
| `app/routes/__init__.py` | Blueprint 등록 (`/api/stock-analyzer`) |
| `frontend/src/app/dashboard/stock-analyzer/page.tsx` | 전용 분석 페이지 |
| `frontend/src/components/layout/CommandPalette.tsx` | ⌘K 검색 → 페이지 리다이렉트 |
| `frontend/src/components/layout/Sidebar.tsx` | ProPicks 네비 항목 |
| `frontend/src/components/layout/Header.tsx` | ⌘K 단축키 + CommandPalette 연동 |
| `frontend/next.config.ts` | API 프록시 (`/api/stock-analyzer/*` → Flask) |
| **독립 실행형** | |
| `app.py` | Flask 단독 웹앱 (포트 5000, UI 서빙) |
| `stock_info.py` | 일괄 스크래핑 스크립트 (2,500개 전체) |
| `stock_data.xlsx` | 종목 목록 (순번, 종목명, URL) 2,500건 |
| `templates/index.html` | 단독 웹 UI |

### 대시보드 사용 흐름
```
1. 사이드바 → ProPicks 클릭
   또는 ⌘K → 종목 검색 → 선택
       ↓
2. /dashboard/stock-analyzer?name=X&url=Y&id=Z
       ↓ (URL 파라미터 → 자동 분석 시작)
3. POST /api/stock-analyzer/analyze → Selenium 스크래핑
       ↓
4. 결과 표시 (컬러 배지) + 조회 기록 테이블 누적
       ↓
5. POST /api/stock-analyzer/export → Excel 다운로드
```

### API 엔드포인트
| Method | Path | 설명 |
|--------|------|------|
| GET | `/api/stock-analyzer/search?q=삼성` | 종목 검색 (최대 20건) |
| POST | `/api/stock-analyzer/analyze` | 단건 스크래핑 (`{url, name}`) |
| POST | `/api/stock-analyzer/export` | 조회 기록 Excel 변환 (`{records}`) |

### 결과 컬러 매핑
| ProPicks 결과 | 배지 색상 |
|---------------|----------|
| 적극 매수 / 매수 | 빨강 (red) |
| 중립 | 노랑 (yellow) |
| 매도 / 적극 매도 | 파랑 (blue) |

### 독립 실행
```bash
# 단독 웹앱 - http://localhost:5000
cd "$PROJECT" && "$PYTHON" app.py

# 일괄 스크래핑 (2,500개 전체)
cd "$PROJECT" && "$PYTHON" -u stock_info.py
```

### 핵심 로직
- **XPath**: `//*[@id='pro-score-mobile']/div/div[2]/div[3]/div/div/div[1]/div`
- **스크래핑 방식**: Selenium headless Chrome (모바일 UA), 단건 요청마다 새 드라이버 생성→종료
- **Cloudflare 주의**: 연속 대량 요청 시 차단됨. 단건 호출은 정상 동작

### 의존성
```
pandas, selenium, webdriver-manager, flask, openpyxl
```
