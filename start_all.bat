@echo off
chcp 65001 >nul
title MarketFlow Services

:: ====================================
:: MarketFlow 전체 서비스 자동 시작
:: Flask(5001) + Next.js(4000) + Scheduler(daemon)
:: ====================================

set PROJECT=C:\closing_bet
set PYTHON=%PROJECT%\.venv\Scripts\python.exe
set FRONTEND=%PROJECT%\frontend
set PYTHONIOENCODING=utf-8

:: 1) Flask API (port 5001)
echo [1/3] Starting Flask API (port 5001)...
start /B "Flask" cmd /c "cd /d %PROJECT% && %PYTHON% flask_app.py"
timeout /t 3 /nobreak >nul

:: 2) Next.js (port 4000)
echo [2/3] Starting Next.js (port 4000)...
start /B "NextJS" cmd /c "cd /d %FRONTEND% && npm start"
timeout /t 5 /nobreak >nul

:: 3) Scheduler Daemon
echo [3/3] Starting Scheduler Daemon...
start /B "Scheduler" cmd /c "cd /d %PROJECT% && %PYTHON% scheduler.py --daemon"
timeout /t 2 /nobreak >nul

echo.
echo ========================================
echo  All services started!
echo  Flask:     http://localhost:5001
echo  Next.js:   http://localhost:4000
echo  Scheduler: daemon mode (auto-schedule)
echo ========================================
