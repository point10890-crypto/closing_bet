# KR Market 스케줄러 & 텔레그램 알림 설정 가이드

## 목차
1. [텔레그램 봇 생성](#1-텔레그램-봇-생성)
2. [환경변수 설정](#2-환경변수-설정)
3. [스케줄러 실행](#3-스케줄러-실행)
4. [macOS 자동 실행 (launchd)](#4-macos-자동-실행-launchd)
5. [Windows 자동 실행 (작업 스케줄러)](#5-windows-자동-실행-작업-스케줄러)
6. [알림 메시지 예시](#6-알림-메시지-예시)
7. [관리 명령어](#7-관리-명령어)
8. [트러블슈팅](#8-트러블슈팅)

---

## 1. 텔레그램 봇 생성

### Step 1: BotFather에서 봇 만들기
1. 텔레그램에서 **@BotFather** 검색
2. `/newbot` 입력
3. 봇 이름 설정 (예: `KR Market Bot`)
4. 봇 username 설정 (예: `my_stock_market_bot`)
5. **API 토큰**을 받음 (예: `8196156647:AAElFplNa80zOSnuAbQzB89QK6Qq7bEetes`)

### Step 2: Chat ID 확인
1. 텔레그램에서 방금 만든 봇에게 아무 메시지 전송 (예: `/start` 또는 `hello`)
2. 브라우저에서 아래 URL 접속 (토큰 부분을 본인 토큰으로 교체):
   ```
   https://api.telegram.org/bot{YOUR_TOKEN}/getUpdates
   ```
3. 응답 JSON에서 `"chat":{"id":숫자}` 부분이 **Chat ID**

   ```json
   {
     "result": [{
       "message": {
         "chat": {
           "id": 7769030562    ← 이 숫자가 Chat ID
         }
       }
     }]
   }
   ```

### Step 3: 테스트 메시지 전송
```bash
python3 -c "
import requests
TOKEN = 'YOUR_BOT_TOKEN'
CHAT_ID = 'YOUR_CHAT_ID'
url = f'https://api.telegram.org/bot{TOKEN}/sendMessage'
requests.post(url, json={'chat_id': CHAT_ID, 'text': '테스트 메시지!'})
"
```

---

## 2. 환경변수 설정

프로젝트 루트의 `.env` 파일에 추가:

```env
# Telegram Bot (KR Market 알림)
TELEGRAM_BOT_TOKEN=your_bot_token_here
TELEGRAM_CHAT_ID=your_chat_id_here
```

---

## 3. 스케줄러 실행

### 스케줄 시간표 (평일 KST)

| 시간 | 작업 | 설명 |
|------|------|------|
| 15:40 | 가격 업데이트 | 당일 종가 수집 |
| 15:50 | 수급 데이터 | 기관/외국인 매매 수집 |
| 16:03 | 종가베팅 V2 | AI 분석 → 텔레그램 결과 전송 |
| 16:20 | VCP 시그널 | 차트 패턴 스캔 |
| 16:35 | 리포트 | 일일 리포트 생성 |

### 수동 실행

```bash
# 전체 업데이트
python3 kr_market/scheduler.py --now

# 개별 실행
python3 kr_market/scheduler.py --prices      # 가격만
python3 kr_market/scheduler.py --inst         # 수급만
python3 kr_market/scheduler.py --jongga-v2    # 종가베팅만
python3 kr_market/scheduler.py --signals      # VCP 시그널만

# 데몬 모드 (백그라운드 스케줄러)
python3 kr_market/scheduler.py --daemon
```

### 종가베팅 V2 자동 선행 작업 체크

종가베팅 실행 시 자동으로 확인:
```
종가베팅 V2 시작
  ├─ daily_prices.csv 오늘 업데이트됐나?
  │   └─ NO → 가격 업데이트 먼저 실행
  ├─ all_institutional_trend_data.csv 오늘 업데이트됐나?
  │   └─ NO → 수급 업데이트 먼저 실행
  └─ 선행 데이터 확인 완료 → 분석 시작 → 텔레그램 결과 전송
```

---

## 4. macOS 자동 실행 (launchd)

### 설정 파일 생성

`~/Library/LaunchAgents/com.krmarket.scheduler.plist`:

```xml
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
    <key>Label</key>
    <string>com.krmarket.scheduler</string>

    <key>ProgramArguments</key>
    <array>
        <string>/path/to/project/.venv/bin/python3</string>
        <string>/path/to/project/kr_market/scheduler.py</string>
        <string>--daemon</string>
    </array>

    <key>WorkingDirectory</key>
    <string>/path/to/project</string>

    <key>EnvironmentVariables</key>
    <dict>
        <key>PYTHONPATH</key>
        <string>/path/to/project</string>
        <key>PYTHONUNBUFFERED</key>
        <string>1</string>
    </dict>

    <key>RunAtLoad</key>
    <true/>

    <key>KeepAlive</key>
    <true/>

    <key>StandardOutPath</key>
    <string>/path/to/project/logs/scheduler_launchd.log</string>

    <key>StandardErrorPath</key>
    <string>/path/to/project/logs/scheduler_launchd_error.log</string>
</dict>
</plist>
```

> `/path/to/project` 를 실제 프로젝트 경로로 변경

### 관리 명령어

```bash
# 서비스 등록 및 시작
launchctl load ~/Library/LaunchAgents/com.krmarket.scheduler.plist

# 서비스 중지 및 해제
launchctl unload ~/Library/LaunchAgents/com.krmarket.scheduler.plist

# 상태 확인
launchctl list | grep krmarket

# 프로세스 확인
ps aux | grep scheduler

# 로그 실시간 확인
tail -f ~/Documents/국내주식/logs/scheduler_launchd_error.log
```

### 특징
- 맥 부팅 시 자동 시작 (`RunAtLoad`)
- 크래시 시 자동 재시작 (`KeepAlive`)
- 로그아웃해도 유지

---

## 5. Windows 자동 실행 (작업 스케줄러)

### 방법 1: 배치 파일 + 작업 스케줄러 (추천)

#### Step 1: 배치 파일 생성

프로젝트 루트에 `start_scheduler.bat` 생성:

```bat
@echo off
cd /d "C:\Users\사용자\Documents\국내주식"
call .venv\Scripts\activate
python kr_market\scheduler.py --daemon
```

#### Step 2: 작업 스케줄러 등록

1. `Win + R` → `taskschd.msc` → Enter
2. 오른쪽 패널 → **작업 만들기** 클릭
3. **일반** 탭:
   - 이름: `KR Market Scheduler`
   - "사용자가 로그온 여부에 관계없이 실행" 선택
   - "가장 높은 수준의 권한으로 실행" 체크
4. **트리거** 탭 → 새로 만들기:
   - 시작: **컴퓨터 시작 시**
   - 또는: **로그온할 때**
5. **동작** 탭 → 새로 만들기:
   - 작업: **프로그램 시작**
   - 프로그램: `C:\Users\사용자\Documents\국내주식\start_scheduler.bat`
   - 시작 위치: `C:\Users\사용자\Documents\국내주식`
6. **설정** 탭:
   - "작업이 이미 실행 중이면 새 인스턴스 시작 안 함" 선택
   - "작업이 실패한 경우 다시 시작" 체크 → 간격: 1분 / 시도 횟수: 3

#### Step 3: 확인

```powershell
# 작업 상태 확인
schtasks /query /tn "KR Market Scheduler"

# 수동 실행
schtasks /run /tn "KR Market Scheduler"

# 중지
schtasks /end /tn "KR Market Scheduler"
```

### 방법 2: PowerShell 스크립트

프로젝트 루트에 `start_scheduler.ps1` 생성:

```powershell
$ProjectDir = "C:\Users\사용자\Documents\국내주식"
$PythonPath = "$ProjectDir\.venv\Scripts\python.exe"

Set-Location $ProjectDir
$env:PYTHONPATH = $ProjectDir
$env:PYTHONUNBUFFERED = "1"

& $PythonPath kr_market\scheduler.py --daemon
```

작업 스케줄러에서 동작 설정:
- 프로그램: `powershell.exe`
- 인수: `-ExecutionPolicy Bypass -File "C:\Users\사용자\Documents\국내주식\start_scheduler.ps1"`

### 방법 3: NSSM (Non-Sucking Service Manager)

Windows 서비스로 등록하여 완전한 백그라운드 실행:

```powershell
# NSSM 설치 (chocolatey)
choco install nssm

# 서비스 등록
nssm install KRMarketScheduler "C:\Users\사용자\Documents\국내주식\.venv\Scripts\python.exe"
nssm set KRMarketScheduler AppParameters "kr_market\scheduler.py --daemon"
nssm set KRMarketScheduler AppDirectory "C:\Users\사용자\Documents\국내주식"
nssm set KRMarketScheduler AppEnvironmentExtra "PYTHONPATH=C:\Users\사용자\Documents\국내주식" "PYTHONUNBUFFERED=1"
nssm set KRMarketScheduler AppStdout "C:\Users\사용자\Documents\국내주식\logs\scheduler.log"
nssm set KRMarketScheduler AppStderr "C:\Users\사용자\Documents\국내주식\logs\scheduler_error.log"

# 서비스 시작
nssm start KRMarketScheduler

# 서비스 중지
nssm stop KRMarketScheduler

# 서비스 상태
nssm status KRMarketScheduler

# 서비스 삭제
nssm remove KRMarketScheduler confirm
```

---

## 6. 알림 메시지 예시

### 스케줄러 시작
```
⏰ KR Market 스케줄러 시작

📈 가격: 15:40
🏛 수급: 15:50
🎯 종가베팅: 16:03
📊 시그널: 16:20
📋 리포트: 16:35
```

### 종가베팅 V2 결과
```
📊 종가베팅 V2 (01/27)

분석 종목: 7개 | 시그널: 1개
소요 시간: 176초
────────────────────

🥈 우리기술 (032820) KOSDAQ
  등급: B | 점수: 7 | 등락: +19.5%
  진입: 8,470원 | 목표: 8,893원 | 손절: 8,215원
  테마: 로봇, AI반도체, 원자력
  💡 AI 서버향 매출 본격화, 의료 로봇 일본 판매 승인...
```

### 실패 알림
```
❌ 종가베팅 V2 분석 실패
```

---

## 7. 관리 명령어

### macOS

```bash
# 스케줄러 상태
launchctl list | grep krmarket

# 시작
launchctl load ~/Library/LaunchAgents/com.krmarket.scheduler.plist

# 중지
launchctl unload ~/Library/LaunchAgents/com.krmarket.scheduler.plist

# 로그
tail -f ~/Documents/국내주식/logs/scheduler_launchd_error.log

# 프로세스 확인
ps aux | grep scheduler
```

### Windows

```powershell
# 작업 스케줄러 방식
schtasks /query /tn "KR Market Scheduler"
schtasks /run /tn "KR Market Scheduler"
schtasks /end /tn "KR Market Scheduler"

# NSSM 방식
nssm status KRMarketScheduler
nssm start KRMarketScheduler
nssm stop KRMarketScheduler
nssm restart KRMarketScheduler
```

### 공통 (수동 실행)

```bash
# 전체 업데이트
python3 kr_market/scheduler.py --now

# 종가베팅만
python3 kr_market/scheduler.py --jongga-v2

# 가격 + 수급 + 종가베팅
python3 kr_market/scheduler.py --prices
python3 kr_market/scheduler.py --inst
python3 kr_market/scheduler.py --jongga-v2
```

---

## 8. 트러블슈팅

### 텔레그램 메시지가 안 옴
```bash
# .env 확인
grep TELEGRAM .env

# 수동 테스트
python3 -c "
from kr_market.scheduler import send_telegram
result = send_telegram('테스트')
print('성공' if result else '실패 - .env 확인')
"
```

### 스케줄러가 안 돌아감 (macOS)
```bash
# plist 문법 검사
plutil ~/Library/LaunchAgents/com.krmarket.scheduler.plist

# 에러 로그 확인
cat ~/Documents/국내주식/logs/scheduler_launchd_error.log

# 재시작
launchctl unload ~/Library/LaunchAgents/com.krmarket.scheduler.plist
launchctl load ~/Library/LaunchAgents/com.krmarket.scheduler.plist
```

### 스케줄러가 안 돌아감 (Windows)
```powershell
# 작업 상태 확인
schtasks /query /tn "KR Market Scheduler" /v

# 이벤트 로그 확인
Get-WinEvent -LogName "Microsoft-Windows-TaskScheduler/Operational" | Select -First 10

# 로그 파일 확인
Get-Content "C:\Users\사용자\Documents\국내주식\logs\scheduler.log" -Tail 30
```

### 종가베팅이 선행 데이터 없이 돌아감
종가베팅은 자동으로 `daily_prices.csv`와 `all_institutional_trend_data.csv`의 수정 날짜를 확인합니다.
오늘 날짜가 아니면 자동으로 선행 작업을 먼저 실행합니다.

수동으로 확인:
```bash
# 파일 수정 시간 확인
ls -la kr_market/data/daily_prices.csv
ls -la kr_market/data/all_institutional_trend_data.csv
```
