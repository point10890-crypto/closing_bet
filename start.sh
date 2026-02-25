#!/bin/bash
# MarketFlow - Local Dev Server Startup
# Usage: cd /c/closing_bet && bash start.sh

PROJECT="/c/closing_bet"
PYTHON="$PROJECT/.venv/Scripts/python.exe"
FRONTEND="$PROJECT/frontend"

echo "============================================"
echo "  MarketFlow Local Dev Server"
echo "============================================"
echo ""

# 1. Kill existing processes
echo "[1/4] Cleaning ports 5001, 4000..."
netstat -ano | grep -E ':5001|:4000' | grep LISTENING | awk '{print $5}' | sort -u | while read pid; do
    [ "$pid" != "0" ] && taskkill //F //PID "$pid" 2>/dev/null
done
sleep 2
echo "  Done"
echo ""

# 2. Start Flask backend
echo "[2/4] Starting Flask API (port 5001)..."
cd "$PROJECT" && PYTHONIOENCODING=utf-8 "$PYTHON" flask_app.py &
sleep 4
if netstat -ano | grep ':5001' | grep LISTENING > /dev/null 2>&1; then
    echo "  Flask API: http://127.0.0.1:5001 OK"
else
    echo "  Flask API: FAILED"
    exit 1
fi
echo ""

# 3. Start Next.js frontend
echo "[3/4] Starting Next.js (port 4000)..."
cd "$FRONTEND" && npm run dev &
sleep 8
if netstat -ano | grep ':4000' | grep LISTENING > /dev/null 2>&1; then
    echo "  Next.js:   http://localhost:4000 OK"
else
    echo "  Next.js:   FAILED"
    exit 1
fi
echo ""

# 4. Health check
echo "[4/4] Health check..."
HEALTH=$(curl -s -o /dev/null -w "%{http_code}" http://127.0.0.1:5001/api/health)
FRONT=$(curl -s -o /dev/null -w "%{http_code}" http://localhost:4000)
echo "  Backend:  $HEALTH"
echo "  Frontend: $FRONT"
echo ""
echo "============================================"
echo "  Backend:  http://127.0.0.1:5001"
echo "  Frontend: http://localhost:4000"
echo "============================================"
