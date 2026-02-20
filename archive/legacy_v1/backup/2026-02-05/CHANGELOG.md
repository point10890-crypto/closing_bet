# KR Market Package - 변경 이력 (2026-02-05)

## 수정된 파일 목록

### 1. `engine/llm_analyzer.py`
**변경 내용**: LLMAnalyzer 클래스에 `.model` 속성 추가
- **문제**: `generator.py`에서 `self.llm_analyzer.model` 체크 시 None 반환
- **해결**: `self.model = self.gemini.model or self.openai.client` 추가

```python
# Line 245-250
def __init__(self):
    self.perplexity = PerplexityClient()
    self.gemini = GeminiAnalyzer()
    self.openai = OpenAIAnalyzer()
    # model 속성 추가 (generator.py 호환성)
    self.model = self.gemini.model or self.openai.client
```

### 2. `engine/config.py`
**변경 내용**: 필터 기준 완화
- `min_trading_value`: 500억 → 5억
- `min_change_pct`: 5.0% → 3.0%
- 등급별 거래대금 기준 대폭 완화 (S: 1조→500억, A: 5천억→100억, B: 1천억→20억, C: 500억→5억)

### 3. `engine/scorer.py`
**변경 내용**: 스코어링 기준 완화
- 거래대금 점수: 500억/100억/20억/5억 기준으로 변경
- 뉴스 점수: LLM 0점이어도 뉴스 2개 이상이면 1점 부여

### 4. `scheduler.py`
**변경 내용**: 텔레그램 알림 기능 추가
- VCP 시그널 Top 10 텔레그램 전송 기능 추가
- 종가베팅 S/A급만 텔레그램 전송 (B급 제외)
- 메시지 분할 전송 (텔레그램 4096자 제한 대응)

### 5. `frontend/src/app/dashboard/kr/closing-bet/page.tsx`
**변경 내용**: ThemeCloudWidget 오류 수정
- 빈 배열 처리 가드 추가 (sortedThemes 접근 시)

### 6. `frontend/src/lib/api.ts`
**변경 내용**: API 베이스 URL 직접 연결
- **문제**: Next.js 프록시 무반응으로 대시보드 멈춤
- **해결**: Flask 백엔드 직접 연결 `API_BASE = 'http://localhost:5001'`

---

## 결과 요약

| 항목 | Before | After |
|------|--------|-------|
| 종가베팅 시그널 | 0개 | 43개 |
| S급 | 0 | 2 |
| A급 | 0 | 18 |
| B급 | 0 | 23 |

## 텔레그램 알림

| 시간 | 작업 | 알림 내용 |
|------|------|----------|
| 15:20 | 종가베팅 V2 | S/A급 시그널만 |
| 16:20 | VCP 스캔 | Top 10 시그널 |
