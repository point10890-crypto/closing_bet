# KR Market Package - Claude Code 설정

## 프로젝트 경로 (절대 고정 - 변경 금지)

- **프로젝트 루트**: `/c/closing_bet`
- **Python**: `/c/closing_bet/.venv/Scripts/python.exe`
- **Frontend**: `/c/closing_bet/frontend`
- **Shell 환경**: Git Bash (MINGW64) - 반드시 MINGW 스타일 경로 사용

## 변수 정의 (모든 Bash 명령어 실행 시 반드시 사용)

```bash
PROJECT="/c/closing_bet"
PYTHON="$PROJECT/.venv/Scripts/python.exe"
FRONTEND="$PROJECT/frontend"
```

## 서버 시작 명령어

### Flask 서버 (포트 5001)
```bash
cd "$PROJECT" && "$PYTHON" flask_app.py &
```

### Next.js 서버 (포트 4000)
```bash
cd "$FRONTEND" && npm start &
```

### 스케줄러
```bash
cd "$PROJECT" && "$PYTHON" scheduler.py &
```

## 절대 규칙 (매 세션 반드시 준수)

1. **경로**: Windows 경로(`C:\...`) 사용 금지. 항상 MINGW 경로 사용: `/c/closing_bet`
2. **Python 실행**: 항상 `"$PYTHON"` 변수 사용. 절대 `python`, `py`, `.venv\Scripts\python.exe` 직접 사용 금지
3. **작업 디렉토리**: 명령어 실행 전 반드시 `cd "$PROJECT"` 선행
4. **따옴표**: 모든 경로 변수는 반드시 큰따옴표(`"`)로 감싸기
5. **백그라운드**: 서버는 `&`로 백그라운드 실행 후 포트 확인

## 포트 확인
```bash
netstat -ano | grep -E "5001|4000"
```

## 프로세스 종료
```bash
netstat -ano | grep 5001 | awk '{print $5}' | xargs kill -f 2>/dev/null
netstat -ano | grep 4000 | awk '{print $5}' | xargs kill -f 2>/dev/null
```

## 프로젝트 구조
- `flask_app.py` - Flask API 서버 (포트 5001)
- `frontend/` - Next.js 대시보드 (포트 4000)
- `engine/` - 종가베팅 V2 분석 엔진
- `scheduler.py` - 자동 스케줄러
- `screener.py` - Smart Money Screener
- `market_gate.py` - 시장 레짐 감지
- `data/` - 데이터 저장소
- `backtest/` - 백테스트 엔진
