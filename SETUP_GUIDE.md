# KR Market Package - 실행 가이드

## 🚀 빠른 시작 (5분 설치)

### 1. 환경 설정

```bash
# .env 파일에 API 키 입력
nano .env
# GEMINI_API_KEY=your_api_key_here 입력 후 저장
```

### 2. Python 의존성 설치

```bash
pip install -r requirements.txt
```

### 3. 서버 실행

**터미널 1 - Flask 백엔드:**
```bash
cd C:\closing_bet
python3 flask_app.py
```

**터미널 2 - Next.js 프론트엔드:**
```bash
cd C:\closing_bet\frontend
npm install  # 최초 1회
npm run build && npm start
```

### 4. 접속

- **대시보드**: http://localhost:4000/dashboard/kr
- **종가베팅**: http://localhost:4000/dashboard/kr/closing-bet
- **VCP 시그널**: http://localhost:4000/dashboard/kr/vcp
- **데이터 상태**: http://localhost:4000/dashboard/data-status

---

## 📁 폴더 구조

```
C:\closing_bet\
├── flask_app.py          # Flask 서버 진입점
├── .env                   # API 키 설정 (직접 수정)
├── requirements.txt       # Python 의존성
├── data/                  # 시그널/가격 데이터
├── engine/                # 종가베팅 V2 엔진
├── frontend/              # Next.js 대시보드
└── app/routes/            # API 라우트
```

---

## ⚠️ 문제 해결

### 서버가 연결되지 않을 때
```bash
# Flask 서버 상태 확인
curl http://localhost:5001/api/kr/signals

# 프로세스 확인
ps aux | grep flask
ps aux | grep next
```

### 데이터가 표시되지 않을 때
1. Flask 서버가 실행 중인지 확인
2. `data/` 폴더에 JSON/CSV 파일이 있는지 확인
3. 브라우저 개발자 도구 → Network 탭에서 API 응답 확인

---

## 📞 지원

문제 발생 시 이메일로 연락 주세요.
