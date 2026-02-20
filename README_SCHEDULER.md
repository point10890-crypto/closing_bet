# KR Market 자동화 스케줄러 가이드

> **최종 업데이트**: 2026-02-05
> **경로**: `C:\closing_bet`

---

## 📁 파일 구조

```
C:\closing_bet\
├── scheduler.py              # 메인 스케줄러 (Python)
├── run_scheduler.bat         # Windows 배치 실행기 (자동 복구)
├── run_scheduler.ps1         # PowerShell 실행기 (자동 복구)
├── install_scheduler.bat     # Windows 작업 스케줄러 등록
├── run_now.bat              # 즉시 전체 업데이트
├── run_jongga_v2.bat        # 종가베팅 V2만 실행
├── run_vcp.bat              # VCP 시그널만 실행
├── .env                      # 환경변수 (API 키, 텔레그램 등)
├── engine/                   # 종가베팅 V2 엔진
│   ├── llm_analyzer.py      # LLM 뉴스 분석
│   ├── generator.py         # 시그널 생성
│   ├── scorer.py            # 점수 계산
│   └── config.py            # 설정
├── data/                     # 데이터 저장
│   ├── jongga_v2_latest.json # 종가베팅 최신 결과
│   ├── signals_log.csv       # VCP 시그널 로그
│   └── daily_prices.csv      # 일별 가격
├── logs/                     # 로그 파일
│   └── scheduler_YYYYMMDD.log
└── backup/                   # 백업
    └── 2026-02-05/
```

---

## ⏰ 스케줄 시간표 (평일 KST)

| 시간 | 작업 | 텔레그램 알림 |
|------|------|--------------|
| **15:20** | 종가베팅 V2 분석 | S/A급 시그널만 |
| 16:00 | 가격 데이터 업데이트 | - |
| 16:10 | 수급 데이터 업데이트 | - |
| **16:20** | VCP 시그널 스캔 | Top 10 시그널 |
| 16:30 | 일일 리포트 생성 | - |
| 토 10:00 | 히스토리 수집 | - |

---

## 🚀 빠른 시작

### 1. 수동 실행 (테스트용)

```batch
:: 전체 업데이트
run_now.bat

:: 종가베팅만
run_jongga_v2.bat

:: VCP 스캔만
run_vcp.bat
```

### 2. 스케줄러 데몬 실행

```batch
:: 배치 파일로 실행 (자동 복구 포함)
run_scheduler.bat

:: 또는 직접 Python 실행
.venv\Scripts\python.exe scheduler.py --daemon
```

### 3. Windows 작업 스케줄러 등록 (부팅 시 자동 시작)

1. `install_scheduler.bat`를 **관리자 권한**으로 실행
2. 컴퓨터 시작 시 자동으로 스케줄러가 실행됨

```batch
:: 수동으로 작업 등록 (관리자 권한 필요)
schtasks /create /tn "KR_Market_Scheduler" /tr "powershell.exe -ExecutionPolicy Bypass -File \"C:\closing_bet\run_scheduler.ps1\"" /sc onstart /delay 0001:00 /ru "%USERNAME%" /rl highest /f
```

---

## 🔧 환경 설정 (.env)

```env
# Telegram Bot (필수)
TELEGRAM_BOT_TOKEN=your_bot_token_here
TELEGRAM_CHAT_ID=your_chat_id_here

# Google Gemini API (필수)
GOOGLE_API_KEY=your_gemini_api_key
GEMINI_MODEL=gemini-2.0-flash

# OpenAI API (선택 - Gemini 폴백용)
OPENAI_API_KEY=your_openai_api_key
OPENAI_MODEL=gpt-4o-mini

# Perplexity API (선택 - 실시간 뉴스 검색)
PERPLEXITY_API_KEY=your_perplexity_api_key

# 스케줄 시간 커스터마이징 (선택)
KR_MARKET_CLOSING_BET_TIME=15:20
KR_MARKET_PRICE_TIME=16:00
KR_MARKET_INST_TIME=16:10
KR_MARKET_SIGNAL_TIME=16:20
KR_MARKET_REPORT_TIME=16:30
```

---

## 🔄 자동 복구 시스템

`run_scheduler.ps1` 및 `run_scheduler.bat`는 다음 기능을 포함:

1. **중복 실행 방지**: Lock 파일로 동시 실행 차단
2. **자동 재시작**: 에러 발생 시 최대 5회 재시도
3. **재시도 간격**: 60초 대기 후 재시작
4. **좀비 프로세스 대응**: 1시간 이상 된 Lock 파일 자동 삭제
5. **실패 알림**: 최대 재시도 초과 시 텔레그램 알림

---

## 📱 텔레그램 알림 형식

### 종가베팅 V2 (S/A급만)

```
🎯 종가베팅 V2 (2026-02-05)

총 43개 시그널 (S:2 A:18 B:23)
────────────────────

🥇 디어유 (376300) KOSDAQ
   등급: S | 점수: 10 | 등락: +14.1%
   진입: 43,350원 | 목표: 45,517원
   테마: 팬 커뮤니케이션 플랫폼, K-pop IP
   💡 4분기 호실적과 중국 사업 확장 기대감...

🥈 신성이엔지 (011930) KOSPI
   등급: A | 점수: 11 | 등락: +7.5%
   ...
```

### VCP 시그널 Top 10

```
📈 VCP 시그널 Top 10 (02/05)
총 145개 중 상위 10개
────────────────────

1. 포스코인터내셔널 (047050) 🔥
   점수: 87.3 | 진입: 68,300원
   외인: +472,469 | 기관: +425,026

2. 대한항공 (003490) 🌍
   점수: 87.3 | 진입: 23,750원
   ...
```

**아이콘 의미**:
- 🥇 S급 시그널
- 🥈 A급 시그널
- 🔥 외인+기관 쌍끌이
- 🌍 외인 순매수
- 🏛 기관 순매수

---

## 📊 명령줄 옵션

```bash
python scheduler.py [옵션]

옵션:
  --now          즉시 전체 업데이트 실행
  --prices       가격 데이터만 업데이트
  --inst         수급 데이터만 업데이트
  --signals      VCP 시그널 스캔만 실행
  --jongga-v2    종가베팅 V2만 실행
  --history      히스토리 수집만 실행
  --daemon       데몬 모드 (스케줄러 상시 실행)
```

---

## 🛠️ 관리 명령어

### 작업 스케줄러 관리

```batch
:: 상태 확인
schtasks /query /tn "KR_Market_Scheduler" /v

:: 수동 실행
schtasks /run /tn "KR_Market_Scheduler"

:: 중지
schtasks /end /tn "KR_Market_Scheduler"

:: 삭제
schtasks /delete /tn "KR_Market_Scheduler" /f
```

### 로그 확인

```batch
:: 최근 로그 확인
type logs\scheduler_20260205.log

:: 실시간 로그 모니터링 (PowerShell)
Get-Content logs\scheduler_20260205.log -Wait -Tail 50
```

### Lock 파일 강제 삭제 (좀비 상태 해제)

```batch
del scheduler.lock
```

---

## ❓ 트러블슈팅

### 1. 텔레그램 알림이 안 옴

```batch
:: .env 확인
type .env | findstr TELEGRAM

:: 수동 테스트
.venv\Scripts\python.exe -c "from scheduler import send_telegram; print(send_telegram('테스트'))"
```

### 2. 스케줄러가 시작되지 않음

```batch
:: Lock 파일 확인 및 삭제
if exist scheduler.lock del scheduler.lock

:: 수동 실행
.venv\Scripts\python.exe scheduler.py --daemon
```

### 3. 종가베팅 시그널이 0개

- `engine/config.py`의 필터 기준 확인
- Gemini API 키 확인 (`.env`)
- 로그 확인: `logs/scheduler_YYYYMMDD.log`

### 4. "이미 실행 중" 메시지가 계속 나옴

```batch
:: Lock 파일 삭제
del scheduler.lock

:: 프로세스 확인 및 종료
tasklist | findstr python
taskkill /f /im python.exe
```

---

## 📝 변경 이력

### 2026-02-05

- 종가베팅 V2 필터 기준 완화 (시그널 0개 → 43개)
- LLMAnalyzer `.model` 속성 추가
- 텔레그램 알림 기능 추가 (VCP Top 10, 종가베팅 S/A급)
- 자동 복구 스크립트 추가 (`run_scheduler.ps1`, `run_scheduler.bat`)
- Windows 작업 스케줄러 설치 스크립트 추가

---

## 📞 지원

문제 발생 시 로그 파일(`logs/scheduler_YYYYMMDD.log`)을 확인하세요.
