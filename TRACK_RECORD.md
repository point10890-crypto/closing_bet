# US Market Smart Money Screener — Track Record

> **마지막 업데이트**: 2026-02-19
> **총 스냅샷**: 1회 | **총 추천 종목**: 10개 | **추적 기간**: 2026-02-19 ~ 2026-02-19

---

## 목차

1. [업데이트 방법](#업데이트-방법)
2. [Smart Money Screener 시스템 요약](#smart-money-screener-시스템-요약)
3. [누적 성과 요약](#누적-성과-요약)
4. [스냅샷별 성과](#스냅샷별-성과)
5. [개별 종목 하이라이트](#개별-종목-하이라이트)
6. [월별 성과 추이](#월별-성과-추이)
7. [전략별 성과 분석](#전략별-성과-분석)
8. [백테스트 결과](#백테스트-결과)
9. [주간 기록 노트](#주간-기록-노트)

---

## 업데이트 방법

### 자동 업데이트 (권장)

```bash
# 1. 성과 추적 스크립트 실행
cd C:\closing_bet
.venv\Scripts\python.exe us_market_preview\performance_tracker.py

# 2. 결과 확인
# → us_market_preview/output/performance_report.json 생성
# → 터미널에 Win Rate, Avg Return, Alpha 출력

# 3. 이 파일에 결과를 아래 양식에 기록
```

**performance_tracker.py가 하는 일:**
1. `us_market_preview/history/picks_YYYY-MM-DD.json`에서 과거 추천 종목 로드 (파일당 Top 10만 사용)
2. yfinance로 현재 가격 + SPY 벤치마크 가격 조회
3. 종목별 수익률 = `(현재가 - 추천가) / 추천가 x 100`
4. Alpha = 종목 수익률 - SPY 동기간 수익률
5. 결과를 `us_market_preview/output/performance_report.json`에 저장

### 수동 업데이트 (대시보드)

1. 대시보드 접속: `http://localhost:4000/dashboard/us/track-record`
2. **Stats Cards** (상단 8개 카드)의 수치 → [누적 성과 요약](#누적-성과-요약)에 기록
3. **Performance by Snapshot Date** 테이블 → [스냅샷별 성과](#스냅샷별-성과)에 기록
4. **Individual Picks** 테이블에서 상위/하위 종목 → [개별 종목 하이라이트](#개별-종목-하이라이트)에 기록

### API 엔드포인트 (자동 갱신)

| Method | Path | 설명 |
|--------|------|------|
| GET | `/api/us/track-record` | 전체 성과 리포트 JSON |
| GET | `/api/us/track-record/snapshots` | 스냅샷 날짜 목록 |
| GET | `/api/us/track-record/snapshot/{date}` | 특정 날짜 추천 종목 |
| POST | `/api/us/track-record/save-snapshot` | 현재 Top Picks를 스냅샷 저장 |

### 데이터 소스 파일 위치

| 파일 | 위치 | 설명 |
|------|------|------|
| 스냅샷 아카이브 | `us_market_preview/history/picks_YYYY-MM-DD.json` | 날짜별 추천 종목 스냅샷 |
| 성과 리포트 | `us_market_preview/output/performance_report.json` | 성과 추적 결과 JSON |
| 스크리너 결과 | `us_market_preview/output/top_picks.json` | 최신 스크리닝 결과 |

---

## Smart Money Screener 시스템 요약

> 이 시스템이 어떻게 종목을 선정하는지 이해하면 성과를 더 잘 분석할 수 있습니다.

### 6-Factor Composite Score (100점 만점)

종합점수는 6개 팩터의 가중 합산으로 계산됩니다:

| 팩터 | 가중치 | 데이터 소스 | 설명 |
|------|--------|------------|------|
| **Supply/Demand (수급)** | 25% | 거래량 분석 + Z-score 정규화 | 수급 단계 (Accumulation/Markup/Distribution 등) |
| **Institutional (기관)** | 20% | SEC 13F 공시 | 기관 보유 비율 변화, 순매수 금액 |
| **Technical (기술적)** | 20% | RSI, MACD, MA20/50/200 | RSI 과매수/과매도, MACD 크로스, 이동평균 배열 |
| **Fundamental (펀더멘털)** | 15% | yfinance 재무 데이터 | PER, 매출성장률, ROE, 배당수익률 |
| **Analyst (애널리스트)** | 10% | yfinance 컨센서스 | 목표가 괴리율, 매수/매도 추천, 커버리지 수 |
| **Relative Strength (상대강도)** | 10% | SPY 대비 20일/60일 수익률 | S&P 500 대비 초과 수익률 |

### 등급 시스템

| 등급 | Composite Score | 의미 | 추천 |
|------|----------------|------|------|
| **S급** | 80점 이상 | 모든 팩터 강세 | 즉시 매수 |
| **A급** | 70~79점 | 대부분 팩터 우수 | 적극 매수 |
| **B급** | 60~69점 | 평균 이상 | 매수 고려 |
| **C급** | 50~59점 | 평균 수준 | 관망 |
| **D급** | 40~49점 | 약세 신호 | 주의 |
| **F급** | 40점 미만 | 다수 팩터 약세 | 회피 |

### 전략 유형 (Dual Score 기반)

시스템은 Swing Score와 Trend Score를 별도 계산합니다:

- **Swing Score**: Volume(40%) + Technical(30%) + RS(30%) — 단기 모멘텀
- **Trend Score**: Institutional(35%) + Fundamental(35%) + Technical(30%) — 중기 성장

| 전략 | 조건 | 특징 |
|------|------|------|
| **Hybrid** | Swing >= 75 AND Trend >= 75 | 단기+중기 모두 강세 (최고 등급) |
| **Swing** | Swing > Trend | 단기 모멘텀 우위 |
| **Trend** | Trend >= Swing | 중장기 성장 우위 |

### Setup 유형

| 셋업 | 조건 | 특징 |
|------|------|------|
| **Parabolic** | RSI > 80 | 과열 구간, 차익실현 주의 |
| **Pullback** | MA 정배열 + RSI 40~60 | 눌림목 매수 기회 |
| **Breakout / Momentum** | MA 정배열 + RSI > 60 | 돌파 진행 중 |
| **Downtrend** | MA 역배열 | 하락 추세, 매수 지양 |
| **Base / Neutral** | 기타 | 횡보/기저 형성 중 |

### 사전 필터링

- Supply/Demand Score >= 50인 종목만 전체 분석 대상으로 진행
- 13F 공시는 Look-Ahead Bias 방지를 위해 **오늘 이전 공시 데이터만** 사용 (45일 지연 반영)

---

## 누적 성과 요약

> 대시보드 상단 Stats Cards 또는 `performance_tracker.py` 실행 결과를 기록합니다.
> *Day 0 (2026-02-19) — 첫 스냅샷, 아직 수익률 추적 시작 전*

| 지표 | 값 | 설명 |
|------|-----|------|
| **Total Picks** | 10 | 전체 추천 종목 수 (스냅샷별 Top 10, 중복 포함) |
| **Unique Tickers** | 10 | 고유 종목 수 (중복 제거) |
| **Win Rate** | 0% | 수익 종목 비율 (Day 0 - 추적 시작) |
| **Avg Return** | +0.00% | 전체 평균 수익률 (Day 0) |
| **Alpha vs SPY** | +0.00% | 평균 초과 수익 (Day 0) |
| **Max Gain** | +0.00% (Ticker: BLK) | 최고 수익 종목 |
| **Max Loss** | +0.00% (Ticker: BLK) | 최대 손실 종목 |
| **Snapshots** | 1 | 추천 기록 횟수 |

---

## 스냅샷별 성과

> 각 스냅샷(추천일)별 성과를 기록합니다.
> 대시보드의 **Performance by Snapshot Date** 테이블에서 가져옵니다.
> 최신이 위로 오도록 역순 기록합니다.

| 추천일 | 종목 수 | Avg Return | SPY Return | Alpha | Win Rate | 비고 |
|--------|---------|------------|------------|-------|----------|------|
| 2026-02-19 | 10 | +0.00% | +0.00% | +0.00% | 60.0% | 첫 스냅샷 (Day 0), 전종목 A등급, Strong Buy |

<!--
기록 방법:
1. performance_tracker.py 실행 또는 대시보드 확인
2. 새 스냅샷 행을 위에 추가 (최신이 위)
3. Alpha = Avg Return - SPY Return
4. 종목 수는 해당 날짜의 Top 10 추천 수 (보통 10)
5. 비고에 시장 특이사항 메모 (FOMC, 어닝, 섹터 이슈 등)
-->

---

## 개별 종목 하이라이트

> 대시보드 Individual Picks 테이블에서 수익률 기준 상위/하위 종목을 기록합니다.
> *2026-02-19 첫 스냅샷 — 10종목 전부 A등급, Strong Buy*

### 현재 추천 종목 (2026-02-19 Snapshot)

| # | Ticker | 종목명 | 섹터 | Score | 등급 | Signal | 추천가 | RSI |
|---|--------|--------|------|-------|------|--------|--------|-----|
| 1 | BLK | BlackRock, Inc. | Financial Services | 86.6 | A | Strong Buy | $1,092.26 | 42.4 |
| 2 | NEE | NextEra Energy, Inc. | Utilities | 85.1 | A | Strong Buy | $91.22 | 63.0 |
| 3 | NVDA | NVIDIA Corporation | Technology | 83.6 | A | Strong Buy | $187.98 | 46.8 |
| 4 | VRTX | Vertex Pharmaceuticals | Healthcare | 82.9 | A | Strong Buy | $470.31 | 46.8 |
| 5 | TXN | Texas Instruments | Technology | 81.8 | A | Strong Buy | $223.32 | 60.6 |
| 6 | MDLZ | Mondelez International | Consumer Defensive | 80.6 | A | Strong Buy | $60.08 | 62.3 |
| 7 | RTX | RTX Corporation | Industrials | 80.1 | A | Strong Buy | $204.81 | 59.1 |
| 8 | GS | Goldman Sachs | Financial Services | 80.0 | A | Strong Buy | $933.73 | 49.3 |
| 9 | CSCO | Cisco Systems | Technology | 79.0 | A | Strong Buy | $78.18 | 48.6 |
| 10 | ABBV | AbbVie Inc. | Healthcare | 77.9 | A | Strong Buy | $228.72 | 62.4 |

### Best Performers (Top 10)

| # | Ticker | 종목명 | 추천일 | 추천가 | 현재가 | 수익률 | Alpha | Score | 등급 |
|---|--------|--------|--------|--------|--------|--------|-------|-------|------|
| — | *Day 0 — 아직 수익률 데이터 없음. 다음 업데이트에서 기록됩니다.* | | | | | | | | |

### Worst Performers (Bottom 10)

| # | Ticker | 종목명 | 추천일 | 추천가 | 현재가 | 수익률 | Alpha | Score | 등급 |
|---|--------|--------|--------|--------|--------|--------|-------|-------|------|
| — | *Day 0 — 아직 수익률 데이터 없음. 다음 업데이트에서 기록됩니다.* | | | | | | | | |

---

## 월별 성과 추이

> 월 단위로 성과를 집계하여 추세를 파악합니다.

| 월 | 추천 수 | Win Rate | Avg Return | Alpha vs SPY | Best Pick | Worst Pick | 비고 |
|----|---------|----------|------------|--------------|-----------|------------|------|
| 2026-02 | 10 | 0% | +0.00% | +0.00% | — | — | 첫 스냅샷 시작 (2/19) |

---

## 전략별 성과 분석

> Smart Money Screener의 팩터별/등급별 성과 분석입니다.
> 어떤 조건의 종목이 가장 좋은 성과를 내는지 파악할 수 있습니다.

### 등급별 성과 (Composite Score 기준)

| 등급 | Score 범위 | 종목 수 | Win Rate | Avg Return | Avg Alpha | 비고 |
|------|-----------|---------|----------|------------|-----------|------|
| A급 | 70~89 | 10 | 0% | +0.00% | +0.00% | 전종목 A등급 (77.9~86.6) |

> *참고: 첫 스냅샷에서 모든 종목이 A등급으로 선정됨. Score 범위: 77.9 (ABBV) ~ 86.6 (BLK)*

### 섹터별 성과

| 섹터 | 추천 수 | Win Rate | Avg Return | Avg Alpha | 비고 |
|------|---------|----------|------------|-----------|------|
| Technology | 3 | 0% | +0.00% | +0.00% | NVDA, TXN, CSCO |
| Financial Services | 2 | 0% | +0.00% | +0.00% | BLK, GS |
| Healthcare | 2 | 0% | +0.00% | +0.00% | VRTX, ABBV |
| Utilities | 1 | 0% | +0.00% | +0.00% | NEE |
| Consumer Defensive | 1 | 0% | +0.00% | +0.00% | MDLZ |
| Industrials | 1 | 0% | +0.00% | +0.00% | RTX |

### RSI 구간별 성과

| RSI 구간 | 종목 수 | 대표 종목 | 비고 |
|----------|---------|----------|------|
| 저점 (30~45) | 1 | BLK (42.4) | 반등 기대 구간 |
| 중립 (45~60) | 5 | NVDA (46.8), VRTX (46.8), CSCO (48.6), GS (49.3), RTX (59.1) | 안정적 진입 구간 |
| 상승 (60~70) | 4 | TXN (60.6), MDLZ (62.3), ABBV (62.4), NEE (63.0) | 모멘텀 구간 |

---

## 백테스트 결과

> `performance_tracker.py` 실행 결과를 기록합니다.

```bash
# 성과 추적 실행
cd C:\closing_bet
.venv\Scripts\python.exe us_market_preview\performance_tracker.py
```

### 최근 실행 결과 (2026-02-19)

| 지표 | Smart Money Portfolio | SPY | 비고 |
|------|----------------------|-----|------|
| **Total Return** | 0.00% | 0.00% | Day 0 |
| **Win Rate** | 0% | — | 추적 시작 |
| **Alpha vs SPY** | 0.00% | — | 기준점 |

### 백테스트 설정

| 항목 | 값 |
|------|-----|
| **추적 시작일** | 2026-02-19 |
| **포트폴리오 종목 수** | 10 (Top 10 동일 비중) |
| **벤치마크** | SPY (S&P 500 ETF) |
| **리밸런싱** | 스냅샷 갱신 시 자동 |
| **전략** | Smart Money Top 10 동일 비중 |

---

## 주간 기록 노트

> 매주 시장 상황과 전략 성과에 대한 간단한 메모를 남깁니다.

### Week of 2026-02-17

**시장 상황**:
- 첫 스냅샷 저장일: 2026-02-19 (수요일)
- Smart Money Screener 성과 추적 시스템 가동 시작

**이번 주 추천 (Top 10)**:

| Ticker | Score | 등급 | Signal | RSI |
|--------|-------|------|--------|-----|
| BLK | 86.6 | A | Strong Buy | 42.4 |
| NEE | 85.1 | A | Strong Buy | 63.0 |
| NVDA | 83.6 | A | Strong Buy | 46.8 |
| VRTX | 82.9 | A | Strong Buy | 46.8 |
| TXN | 81.8 | A | Strong Buy | 60.6 |
| MDLZ | 80.6 | A | Strong Buy | 62.3 |
| RTX | 80.1 | A | Strong Buy | 59.1 |
| GS | 80.0 | A | Strong Buy | 49.3 |
| CSCO | 79.0 | A | Strong Buy | 48.6 |
| ABBV | 77.9 | A | Strong Buy | 62.4 |

**특이사항**:
- Smart Money Screener Track Record 시스템 첫 가동
- 전 종목 A등급, Strong Buy 시그널
- 섹터 분산: Technology(3), Financial Services(2), Healthcare(2), Utilities(1), Consumer Defensive(1), Industrials(1)
- RSI 분포: 42.4~63.0 (과열 없음, 안정적 진입 구간)

**성과 점검**:
- Day 0 — 수익률 추적 기준점 설정 완료
- 다음 주부터 실제 수익률 추적 시작

---

## 분석 인사이트 정리

> 장기간 운용하면서 발견한 패턴과 인사이트를 정리합니다.

### 첫 포트폴리오 특성 (2026-02-19)

- **전종목 A등급**: Score 77.9~86.6, 평균 81.66
- **RSI 안정**: 과매도/과매수 없음 (42.4~63.0)
- **섹터 분산**: 6개 섹터에 분산, Tech 비중 30%
- **시가총액**: 대형주 중심 (BLK, GS, NVDA 등 S&P 500 대형주)

### 효과적인 조합 (관찰 예정)

| # | 조합 조건 | 관찰 기간 | Win Rate | Avg Return | 비고 |
|---|----------|----------|----------|------------|------|
| 1 | *데이터 축적 후 기록 예정* | | | | |

### 피해야 할 조합 (관찰 예정)

| # | 조합 조건 | 관찰 기간 | Win Rate | Avg Return | 비고 |
|---|----------|----------|----------|------------|------|
| 1 | *데이터 축적 후 기록 예정* | | | | |

---

<!--
## 기록 팁

1. **일관성**: 매주 같은 요일(예: 금요일)에 업데이트하세요
2. **솔직함**: 손실도 정직하게 기록하세요. 패턴을 발견하는 데 도움됩니다
3. **비교**: Alpha(SPY 대비 초과수익)가 가장 중요한 지표입니다
4. **등급별 분석**: S/A급 종목만 따로 추적하면 전략 유효성을 더 잘 판단할 수 있습니다
5. **전략 유형 주목**: Hybrid가 항상 좋은지, 특정 시장에서 Swing이 유리한지 관찰하세요
6. **자동화**: performance_tracker.py를 정기적으로 실행하면 수동 입력을 줄일 수 있습니다
7. **3개월 단위**: 최소 3개월 데이터가 쌓인 후 전략별 분석의 의미가 생깁니다
-->
