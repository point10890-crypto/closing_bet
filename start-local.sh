#!/bin/bash
# ============================================================
# MarketFlow 로컬 통합 실행 스크립트
# Flask API (5002) + Next.js (4001) + Scheduler (daemon)
# 경로 고정: C:\closing_bet (/c/closing_bet)
# ============================================================

PROJECT="/c/closing_bet"
PYTHON="$PROJECT/.venv/Scripts/python.exe"
FRONTEND="$PROJECT/frontend"
LOG_DIR="$PROJECT/logs"

FLASK_PORT=5002
NEXT_PORT=4001

mkdir -p "$LOG_DIR"

# ── 함수 ──

stop_all() {
    echo "[STOP] 기존 프로세스 종료 중..."
    for port in $FLASK_PORT $NEXT_PORT; do
        local pids=$(netstat -ano 2>/dev/null | grep ":$port " | grep LISTENING | awk '{print $5}' | sort -u)
        if [ -n "$pids" ]; then
            echo "$pids" | while read pid; do
                powershell.exe -Command "Stop-Process -Id $pid -Force -ErrorAction SilentlyContinue" 2>/dev/null
            done
            echo "  Port $port 프로세스 종료 시도"
        fi
    done
    sleep 2
    echo "[OK] 정리 완료"
}

start_flask() {
    echo "[START] Flask API (port $FLASK_PORT)..."
    cd "$PROJECT"
    "$PYTHON" "$PROJECT/run_flask.py" $FLASK_PORT > "$LOG_DIR/flask.log" 2>&1 &
    local pid=$!
    sleep 4
    if netstat -ano 2>/dev/null | grep -q ":$FLASK_PORT.*LISTENING"; then
        echo "  [OK] Flask API (PID: $pid, port: $FLASK_PORT)"
    else
        echo "  [FAIL] Flask 시작 실패 - 로그: $LOG_DIR/flask.log"
        return 1
    fi
}

start_scheduler() {
    echo "[START] Scheduler (daemon)..."
    cd "$PROJECT"
    "$PYTHON" scheduler.py --daemon > "$LOG_DIR/scheduler.log" 2>&1 &
    local pid=$!
    sleep 2
    echo "  [OK] Scheduler (PID: $pid)"
}

start_nextjs() {
    echo "[START] Next.js (port $NEXT_PORT)..."
    cd "$FRONTEND"
    npm run dev > "$LOG_DIR/nextjs.log" 2>&1 &
    local pid=$!
    sleep 6
    if netstat -ano 2>/dev/null | grep -q ":$NEXT_PORT.*LISTENING"; then
        echo "  [OK] Next.js (PID: $pid, port: $NEXT_PORT)"
    else
        echo "  [FAIL] Next.js 시작 실패 - 로그: $LOG_DIR/nextjs.log"
        return 1
    fi
}

show_status() {
    echo ""
    echo "════════════════════════════════════════════"
    echo " MarketFlow 로컬 서버 상태"
    echo "════════════════════════════════════════════"
    netstat -ano 2>/dev/null | grep ":$FLASK_PORT.*LISTENING" > /dev/null && echo "  [OK] Flask API   -> http://localhost:$FLASK_PORT" || echo "  [X]  Flask API   -> NOT RUNNING"
    netstat -ano 2>/dev/null | grep ":$NEXT_PORT.*LISTENING" > /dev/null && echo "  [OK] Next.js     -> http://localhost:$NEXT_PORT" || echo "  [X]  Next.js     -> NOT RUNNING"
    echo "════════════════════════════════════════════"
    echo "  대시보드: http://localhost:$NEXT_PORT/dashboard"
    echo "  종가베팅: http://localhost:$NEXT_PORT/dashboard/kr/closing-bet"
    echo "  VCP:     http://localhost:$NEXT_PORT/dashboard/kr/vcp"
    echo "  Crypto:  http://localhost:$NEXT_PORT/dashboard/crypto"
    echo "  API:     http://localhost:$FLASK_PORT/api/health"
    echo "════════════════════════════════════════════"
    echo ""
}

# ── 메인 ──
case "${1:-start}" in
    start)
        echo ""
        echo "╔══════════════════════════════════════════╗"
        echo "║  MarketFlow 로컬 서버 시작               ║"
        echo "║  Flask:$FLASK_PORT  Next.js:$NEXT_PORT              ║"
        echo "╚══════════════════════════════════════════╝"
        echo ""
        stop_all
        start_flask
        start_scheduler
        start_nextjs
        show_status
        ;;
    stop)
        stop_all
        ;;
    restart)
        stop_all
        sleep 2
        start_flask
        start_scheduler
        start_nextjs
        show_status
        ;;
    status)
        show_status
        ;;
    flask)
        echo "[RESTART] Flask API..."
        netstat -ano 2>/dev/null | grep ":$FLASK_PORT " | grep LISTENING | awk '{print $5}' | sort -u | while read pid; do
            powershell.exe -Command "Stop-Process -Id $pid -Force" 2>/dev/null
        done
        sleep 2
        start_flask
        ;;
    update)
        echo "[UPDATE] 전체 데이터 업데이트..."
        cd "$PROJECT" && PYTHONIOENCODING=utf-8 "$PYTHON" scheduler.py --now
        ;;
    jongga)
        echo "[JONGGA] 종가베팅 V2 실행..."
        cd "$PROJECT" && PYTHONIOENCODING=utf-8 "$PYTHON" scheduler.py --jongga-v2
        ;;
    vcp)
        echo "[VCP] VCP 시그널 + AI 분석 업데이트..."
        echo "  [1/3] 수급 데이터 업데이트..."
        cd "$PROJECT" && DATA_DIR="$PROJECT/data" PYTHONIOENCODING=utf-8 "$PYTHON" all_institutional_trend_data.py
        echo "  [2/3] VCP 시그널 스캔..."
        cd "$PROJECT" && PYTHONIOENCODING=utf-8 "$PYTHON" -m signal_tracker
        echo "  [3/3] AI 분석 JSON 재생성..."
        cd "$PROJECT" && PYTHONIOENCODING=utf-8 "$PYTHON" -c "
import pandas as pd, json
from datetime import datetime

df = pd.read_csv('data/signals_log.csv', dtype={'ticker': str})
df['ticker'] = df['ticker'].str.zfill(6)
open_df = df[df['status'] == 'OPEN'].sort_values('score', ascending=False).drop_duplicates('ticker')

name_map, market_map = {}, {}
try:
    stocks = pd.read_csv('data/korean_stocks_list.csv', dtype={'ticker': str})
    stocks['ticker'] = stocks['ticker'].str.zfill(6)
    name_map = dict(zip(stocks['ticker'], stocks['name']))
    market_map = dict(zip(stocks['ticker'], stocks.get('market', '')))
except: pass

signals = []
for _, row in open_df.iterrows():
    t = row['ticker']
    signals.append({
        'ticker': t, 'name': name_map.get(t, t),
        'score': float(row.get('score', 0)),
        'contraction_ratio': float(row.get('contraction_ratio', 0)),
        'foreign_5d': int(row.get('foreign_5d', 0)),
        'inst_5d': int(row.get('inst_5d', 0)),
        'entry_price': float(row.get('entry_price', 0)),
        'current_price': float(row.get('entry_price', 0)),
        'return_pct': 0,
        'signal_date': str(row.get('signal_date', '')),
        'market': market_map.get(t, ''),
        'status': 'OPEN'
    })

result = {
    'market_indices': {}, 'signals': signals[:20], 'api_status': 'ok',
    'generated_at': datetime.now().isoformat(),
    'signal_date': datetime.now().strftime('%Y-%m-%d')
}
with open('data/kr_ai_analysis.json', 'w', encoding='utf-8') as f:
    json.dump(result, f, ensure_ascii=False, indent=2)
print(f'  [OK] {len(signals[:20])}개 VCP 시그널 저장 완료')
"
        echo "[OK] VCP 업데이트 완료"
        ;;
    crypto)
        echo "[CRYPTO] 크립토 파이프라인 실행..."
        cd "$PROJECT" && PYTHONIOENCODING=utf-8 "$PYTHON" scheduler.py --crypto
        ;;
    all)
        echo "[ALL] 전체 업데이트 (종가베팅 + VCP + 크립토)..."
        echo ""
        echo "── 종가베팅 V2 ──"
        cd "$PROJECT" && PYTHONIOENCODING=utf-8 "$PYTHON" scheduler.py --jongga-v2
        echo ""
        echo "── VCP 시그널 ──"
        cd "$PROJECT" && DATA_DIR="$PROJECT/data" PYTHONIOENCODING=utf-8 "$PYTHON" all_institutional_trend_data.py
        cd "$PROJECT" && PYTHONIOENCODING=utf-8 "$PYTHON" -m signal_tracker
        cd "$PROJECT" && PYTHONIOENCODING=utf-8 "$PYTHON" -c "
import pandas as pd, json
from datetime import datetime
df = pd.read_csv('data/signals_log.csv', dtype={'ticker': str})
df['ticker'] = df['ticker'].str.zfill(6)
open_df = df[df['status'] == 'OPEN'].sort_values('score', ascending=False).drop_duplicates('ticker')
name_map = {}
try:
    stocks = pd.read_csv('data/korean_stocks_list.csv', dtype={'ticker': str})
    stocks['ticker'] = stocks['ticker'].str.zfill(6)
    name_map = dict(zip(stocks['ticker'], stocks['name']))
except: pass
signals = [{'ticker': row['ticker'], 'name': name_map.get(row['ticker'], row['ticker']),
    'score': float(row.get('score',0)), 'contraction_ratio': float(row.get('contraction_ratio',0)),
    'foreign_5d': int(row.get('foreign_5d',0)), 'inst_5d': int(row.get('inst_5d',0)),
    'entry_price': float(row.get('entry_price',0)), 'current_price': float(row.get('entry_price',0)),
    'return_pct': 0, 'signal_date': str(row.get('signal_date','')), 'status': 'OPEN'
} for _, row in open_df.iterrows()]
with open('data/kr_ai_analysis.json', 'w', encoding='utf-8') as f:
    json.dump({'market_indices': {}, 'signals': signals[:20], 'api_status': 'ok',
        'generated_at': datetime.now().isoformat(), 'signal_date': datetime.now().strftime('%Y-%m-%d')
    }, f, ensure_ascii=False, indent=2)
print(f'  [OK] VCP: {len(signals[:20])}개 시그널')
"
        echo ""
        echo "── 크립토 ──"
        cd "$PROJECT" && PYTHONIOENCODING=utf-8 "$PYTHON" scheduler.py --crypto
        echo ""
        echo "[ALL] 전체 업데이트 완료"
        ;;
    deploy)
        echo "[DEPLOY] Vercel 데이터 동기화 & 배포..."
        bash "$PROJECT/sync-vercel.sh"
        ;;
    update-deploy)
        echo "[UPDATE+DEPLOY] 전체 업데이트 + Vercel 배포..."
        bash "$0" all
        echo ""
        bash "$PROJECT/sync-vercel.sh"
        ;;
    *)
        echo "사용법: $0 {start|stop|restart|status|flask|update|jongga|vcp|crypto|all|deploy|update-deploy}"
        ;;
esac
