@echo off
chcp 65001 >nul 2>&1
title MarketFlow - Unified Launcher
color 0A

:: ─── Dynamic base directory (wherever this .bat lives) ───
set "BASE=%~dp0"
:: Remove trailing backslash
if "%BASE:~-1%"=="\" set "BASE=%BASE:~0,-1%"
set "PYTHON=%BASE%\.venv\Scripts\python.exe"
set "FRONTEND=%BASE%\frontend"
set "API_DIR=%BASE%\closing-bet-api"
set "MVN=C:\tools\apache-maven-3.9.9\bin\mvn.cmd"

echo ============================================================
echo   MarketFlow System - Unified Launcher
echo   Path: %BASE%
echo   Spring Boot: http://127.0.0.1:8080
echo   Next.js:     http://localhost:4000
echo   Scheduler:   Built-in (Spring @Scheduled)
echo   Watchdog:    Auto-restart on failure
echo ============================================================
echo.

cd /d "%BASE%"

:: ─── 1. Kill existing processes ───
echo [1/5] Cleaning existing processes...
for /f "tokens=5" %%a in ('netstat -ano ^| findstr ":8080.*LISTENING"') do (
    taskkill /F /PID %%a >nul 2>&1
)
for /f "tokens=5" %%a in ('netstat -ano ^| findstr ":4000.*LISTENING"') do (
    taskkill /F /PID %%a >nul 2>&1
)
:: Kill old watchdog
for /f "tokens=2 delims=," %%a in ('tasklist /FI "IMAGENAME eq python.exe" /FO CSV /NH 2^>nul') do (
    wmic process where "processid=%%~a" get CommandLine 2>nul | findstr /C:"watchdog.py" >nul 2>&1 && (
        taskkill /F /PID %%~a >nul 2>&1
    )
)
timeout /t 2 /nobreak >nul
echo   Done.
echo.

:: ─── 2. Start Spring Boot Backend (port 8080) ───
echo [2/5] Starting Spring Boot API server (port 8080)...
if not exist "%API_DIR%\pom.xml" (
    echo   ERROR: pom.xml not found at %API_DIR%
    echo   Spring Boot project not found. Aborting.
    pause
    exit /b 1
)
cd /d "%API_DIR%"
start /B "" cmd /c ""%MVN%" spring-boot:run -q > "%BASE%\logs\springboot.log" 2>&1"
cd /d "%BASE%"
echo   Waiting for Spring Boot startup (15s)...
timeout /t 15 /nobreak >nul
curl -s -o nul -w "%%{http_code}" http://127.0.0.1:8080/api/health >nul 2>&1 && (
    echo   Spring Boot: OK
) || (
    echo   Spring Boot: WAITING...
    timeout /t 10 /nobreak >nul
    curl -s -o nul -w "%%{http_code}" http://127.0.0.1:8080/api/health >nul 2>&1 && (
        echo   Spring Boot: OK (delayed)
    ) || (
        echo   Spring Boot: STILL STARTING... (check logs\springboot.log)
    )
)
echo.

:: ─── 3. Start Next.js Frontend (port 4000) ───
echo [3/5] Starting Next.js frontend (port 4000)...
cd /d "%FRONTEND%"
start /B "" cmd /c "npx next start -p 4000" >nul 2>&1
cd /d "%BASE%"
timeout /t 7 /nobreak >nul
curl -s -o nul -w "%%{http_code}" http://localhost:4000 >nul 2>&1 && (
    echo   Next.js: OK
) || (
    echo   Next.js: WAITING...
    timeout /t 5 /nobreak >nul
)
echo.

:: ─── 4. Start Watchdog ───
echo [4/5] Starting Watchdog (auto-restart + Telegram alerts)...
if not exist "logs" mkdir logs
start /B "" "%PYTHON%" watchdog.py >nul 2>&1
echo   Watchdog: Running (30s interval)
echo.

:: ─── 5. Start ngrok ───
echo [5/5] Starting ngrok tunnel (port 4000)...
start /B "" ngrok http 4000 --log=stdout >nul 2>&1
timeout /t 5 /nobreak >nul
curl -s http://127.0.0.1:4040/api/tunnels 2>nul | findstr "public_url" >nul 2>&1 && (
    echo   ngrok: OK
) || (
    echo   ngrok: WAITING...
    timeout /t 5 /nobreak >nul
)
echo.

:: ─── Final Status ───
echo Final Status Check...
timeout /t 3 /nobreak >nul
echo.
echo   --- API Endpoints ---
for %%e in ("/api/health" "/api/kr/signals" "/api/crypto/overview" "/api/econ/overview") do (
    curl -s -o nul -w "  %%e  %%{http_code}" http://127.0.0.1:8080%%~e 2>nul
    echo.
)
echo.
echo   --- Frontend Pages ---
for %%p in ("/" "/login" "/dashboard" "/dashboard/crypto") do (
    curl -s -o nul -w "  %%p  %%{http_code}" http://localhost:4000%%~p 2>nul
    echo.
)

echo.
echo ============================================================
echo   All services started!
echo.
echo   Spring Boot: http://127.0.0.1:8080
echo   Frontend:    http://localhost:4000
echo   ngrok:       (check http://127.0.0.1:4040)
echo   Scheduler:   Built-in Spring @Scheduled (KR + Crypto)
echo   Watchdog:    Active (auto-restart on failure)
echo ============================================================
echo.
:: Auto mode (no pause) when called from Startup
if "%1"=="--auto" goto :eof
echo Press any key to open dashboard in browser...
pause >nul
start http://localhost:4000
