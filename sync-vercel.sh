#!/bin/bash
# ============================================================
# MarketFlow 데이터 동기화 → Vercel 자동 배포
# 로컬 데이터 → JSON 스냅샷 → Git Push → Vercel 자동 배포
# ============================================================

PROJECT="/c/closing_bet"
PYTHON="$PROJECT/.venv/Scripts/python.exe"
FRONTEND="$PROJECT/frontend"
SNAPSHOT_DIR="$FRONTEND/data-snapshot"

mkdir -p "$SNAPSHOT_DIR"

echo ""
echo "╔══════════════════════════════════════════╗"
echo "║  MarketFlow → Vercel 데이터 동기화       ║"
echo "╚══════════════════════════════════════════╝"
echo ""

# ── 1. 데이터 스냅샷 생성 ──
echo "[1/3] 데이터 스냅샷 생성..."

cd "$PROJECT" && PYTHONIOENCODING=utf-8 "$PYTHON" -c "
import json, os, sys
import pandas as pd
from datetime import datetime

SNAPSHOT_DIR = '$SNAPSHOT_DIR'.replace('/c/', 'C:/')
DATA_DIR = os.path.join(os.path.dirname(os.path.abspath('.')), 'closing_bet', 'data')
if not os.path.isdir(DATA_DIR):
    DATA_DIR = 'C:/closing_bet/data'

def save(filename, data):
    path = os.path.join(SNAPSHOT_DIR, filename)
    with open(path, 'w', encoding='utf-8') as f:
        json.dump(data, f, ensure_ascii=False, indent=2, default=str)
    print(f'  [OK] {filename} ({os.path.getsize(path):,} bytes)')

# ── KR Market ──
print('  KR Market:')

# kr/signals (VCP)
try:
    with open(os.path.join(DATA_DIR, 'kr_ai_analysis.json'), 'r', encoding='utf-8') as f:
        save('kr-signals.json', json.load(f))
except Exception as e:
    print(f'  [SKIP] kr-signals: {e}')

# kr/jongga-v2/latest
try:
    with open(os.path.join(DATA_DIR, 'jongga_v2_latest.json'), 'r', encoding='utf-8') as f:
        save('kr-jongga-v2-latest.json', json.load(f))
except Exception as e:
    print(f'  [SKIP] kr-jongga-v2-latest: {e}')

# kr/vcp-stats
try:
    df = pd.read_csv(os.path.join(DATA_DIR, 'signals_log.csv'), dtype={'ticker': str})
    total = len(df)
    closed = df[df['status'] == 'CLOSED']
    open_s = df[df['status'] == 'OPEN']
    if 'return_pct' in closed.columns:
        wins = closed[closed['return_pct'] > 0]
        win_rate = len(wins) / len(closed) * 100 if len(closed) > 0 else 0
        avg_return = closed['return_pct'].mean()
    else:
        win_rate = 0
        avg_return = 0
    save('kr-vcp-stats.json', {
        'total_signals': total, 'closed_signals': len(closed), 'open_signals': len(open_s),
        'win_rate': round(win_rate, 1), 'avg_return_pct': round(avg_return, 2),
        'date_range': {'start': str(df['signal_date'].min()), 'end': str(df['signal_date'].max())}
    })
except Exception as e:
    print(f'  [SKIP] kr-vcp-stats: {e}')

# kr/vcp-history
try:
    df = pd.read_csv(os.path.join(DATA_DIR, 'signals_log.csv'), dtype={'ticker': str})
    df['ticker'] = df['ticker'].str.zfill(6)
    name_map = {}
    try:
        stocks = pd.read_csv(os.path.join(DATA_DIR, 'korean_stocks_list.csv'), dtype={'ticker': str})
        stocks['ticker'] = stocks['ticker'].str.zfill(6)
        name_map = dict(zip(stocks['ticker'], stocks['name']))
    except: pass

    signals = []
    for idx, row in df.sort_values('signal_date', ascending=False).head(100).iterrows():
        t = str(row.get('ticker', '')).zfill(6)
        signals.append({
            'id': int(idx), 'ticker': t, 'name': name_map.get(t, t),
            'signalDate': str(row.get('signal_date', '')),
            'foreign5d': int(row.get('foreign_5d', 0)) if pd.notna(row.get('foreign_5d')) else 0,
            'inst5d': int(row.get('inst_5d', 0)) if pd.notna(row.get('inst_5d')) else 0,
            'score': float(row.get('score', 0)) if pd.notna(row.get('score')) else 0,
            'contractionRatio': float(row.get('contraction_ratio', 0)) if pd.notna(row.get('contraction_ratio')) else 0,
            'entryPrice': float(row.get('entry_price', 0)),
            'status': str(row.get('status', 'OPEN')),
            'exitPrice': float(row.get('exit_price', 0)) if pd.notna(row.get('exit_price')) else None,
            'returnPct': float(row.get('return_pct', 0)) if pd.notna(row.get('return_pct')) else None,
        })
    save('kr-vcp-history.json', {'signals': signals, 'count': len(signals), 'days': 30})
except Exception as e:
    print(f'  [SKIP] kr-vcp-history: {e}')

# ── US Market ──
print('  US Market:')
us_data_dir = os.path.join('C:/closing_bet', 'us-market-pro', 'data')

us_files = {
    'us-market-gate.json': None,  # Will generate from live API
    'us-portfolio.json': 'market_data.json',
    'us-market-regime.json': 'regime_config.json',
    'us-index-prediction.json': 'prediction.json',
    'us-risk-alerts.json': 'risk_alerts.json',
    'us-sector-rotation.json': 'sector_rotation.json',
    'us-market-briefing.json': 'market_briefing.json',
    'us-macro-analysis.json': 'macro_analysis.json',
    'us-cumulative-performance.json': 'performance_report.json',
    'us-top-picks-report.json': 'final_top10_report.json',
    'us-backtest.json': 'backtest_result.json',
    'us-smart-money.json': 'top_picks.json',
}

for snap_name, src_name in us_files.items():
    if not src_name:
        continue
    try:
        src_path = os.path.join(us_data_dir, src_name)
        if os.path.exists(src_path):
            with open(src_path, 'r', encoding='utf-8') as f:
                save(snap_name, json.load(f))
        else:
            print(f'  [SKIP] {snap_name}: source not found')
    except Exception as e:
        print(f'  [SKIP] {snap_name}: {e}')

# US decision-signal (computed)
try:
    import requests
    resp = requests.get('http://localhost:5002/api/us/decision-signal', timeout=5)
    if resp.status_code == 200:
        save('us-decision-signal.json', resp.json())
except Exception as e:
    print(f'  [SKIP] us-decision-signal: {e}')

# US market-gate (live)
try:
    import requests
    resp = requests.get('http://localhost:5002/api/us/market-gate', timeout=5)
    if resp.status_code == 200:
        save('us-market-gate.json', resp.json())
except Exception as e:
    print(f'  [SKIP] us-market-gate: {e}')

# ── Crypto ──
print('  Crypto:')
crypto_data_dir = os.path.join('C:/closing_bet', 'crypto-analytics', 'crypto_market', 'data')

crypto_files = {
    'crypto-briefing.json': 'briefing.json',
    'crypto-market-gate.json': 'gate.json',
    'crypto-prediction.json': 'prediction.json',
    'crypto-risk.json': 'risk.json',
    'crypto-lead-lag.json': 'lead_lag.json',
    'crypto-vcp-signals.json': 'vcp_signals.json',
}

for snap_name, src_name in crypto_files.items():
    try:
        src_path = os.path.join(crypto_data_dir, src_name)
        if os.path.exists(src_path):
            with open(src_path, 'r', encoding='utf-8') as f:
                save(snap_name, json.load(f))
        else:
            print(f'  [SKIP] {snap_name}: source not found')
    except Exception as e:
        print(f'  [SKIP] {snap_name}: {e}')

# ── Health/Meta ──
save('health.json', {'status': 'ok', 'mode': 'static', 'updated_at': datetime.now().isoformat()})

print()
print(f'  Total snapshots: {len(os.listdir(SNAPSHOT_DIR))} files')
"

echo ""

# ── 2. Git Commit & Push ──
echo "[2/3] Git 커밋 & 푸시..."
cd "$PROJECT"

# Add snapshot files + any code changes
git add frontend/data-snapshot/*.json
git add frontend/src/app/api/data/
git add frontend/src/lib/api.ts
git add frontend/next.config.ts
git add frontend/.env.local
git add sync-vercel.sh
git add start-local.sh
git add app/routes/us_market.py
git add scheduler.py

# Check if there are changes to commit
if git diff --cached --quiet; then
    echo "  [SKIP] 변경사항 없음"
else
    TIMESTAMP=$(date '+%Y-%m-%d %H:%M')
    git commit -m "$(cat <<EOF
data: sync snapshot for Vercel deployment ($TIMESTAMP)

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>
EOF
)"
    echo "  [OK] 커밋 완료"

    git push origin main 2>&1 | tail -5
    echo "  [OK] 푸시 완료 → Vercel 자동 배포 시작"
fi

echo ""

# ── 3. 상태 확인 ──
echo "[3/3] 스냅샷 현황..."
ls -la "$SNAPSHOT_DIR"/*.json 2>/dev/null | awk '{print "  " $5 "\t" $9}' | sed 's|.*/||'

echo ""
echo "════════════════════════════════════════════"
echo " Vercel 배포 URL: https://closing-bet.vercel.app"
echo " 로컬 대시보드:   http://localhost:4001/dashboard"
echo "════════════════════════════════════════════"
echo ""
