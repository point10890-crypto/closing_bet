@echo off
title KR Market Dashboard
color 0A

echo.
echo  ========================================================
echo       KR Market - Smart Money Dashboard
echo  ========================================================
echo.

set "PROJECT_DIR=%~dp0"
if "%PROJECT_DIR:~-1%"=="\" set "PROJECT_DIR=%PROJECT_DIR:~0,-1%"
set "VENV_PYTHON=%PROJECT_DIR%\.venv\Scripts\python.exe"
set "FRONTEND_DIR=%PROJECT_DIR%\frontend"
set "DASHBOARD_URL=http://localhost:4000/dashboard/kr"
set "CHROME=C:\Program Files\Google\Chrome\Application\chrome.exe"

echo [1/6] Checking existing servers...

netstat -ano 2>nul | findstr ":5001.*LISTENING" >nul 2>&1
if %errorlevel%==0 (
    echo   OK  Flask already running
    set "FLASK_RUNNING=1"
) else (
    echo   --  Flask needs to start
    set "FLASK_RUNNING=0"
)

netstat -ano 2>nul | findstr ":4000.*LISTENING" >nul 2>&1
if %errorlevel%==0 (
    echo   OK  Next.js already running
    set "NEXTJS_RUNNING=1"
) else (
    echo   --  Next.js needs to start
    set "NEXTJS_RUNNING=0"
)

if "%FLASK_RUNNING%"=="1" if "%NEXTJS_RUNNING%"=="1" (
    echo.
    echo   All servers already running - opening Chrome
    start "" "%CHROME%" "%DASHBOARD_URL%"
    timeout /t 3 /nobreak >nul
    exit
)

if "%FLASK_RUNNING%"=="0" (
    echo.
    echo [2/6] Starting Flask backend...
    cd /d "%PROJECT_DIR%"
    start "Flask-5001" /min cmd /c ""%VENV_PYTHON%" flask_app.py"
    echo   ... waiting 8 seconds for Flask
    timeout /t 8 /nobreak >nul
    echo   OK  Flask started
)

if "%NEXTJS_RUNNING%"=="0" (
    echo.
    echo [3/6] Starting Next.js frontend...
    cd /d "%FRONTEND_DIR%"
    start "NextJS-4000" /min cmd /c "npm start"
    echo   ... waiting 5 seconds for Next.js
    timeout /t 5 /nobreak >nul
    echo   OK  Next.js started
)

echo.
echo [4/6] Verifying servers...
set "RETRY=0"

:CHECK_LOOP
set /a RETRY+=1
if %RETRY% GTR 20 (
    echo   FAIL - Servers did not start in time
    echo   Check the minimized Flask/NextJS windows for errors
    pause
    exit /b 1
)

netstat -ano 2>nul | findstr ":5001.*LISTENING" >nul 2>&1
if %errorlevel% NEQ 0 (
    echo   ... waiting for Flask (%RETRY%/20)
    timeout /t 3 /nobreak >nul
    goto CHECK_LOOP
)

netstat -ano 2>nul | findstr ":4000.*LISTENING" >nul 2>&1
if %errorlevel% NEQ 0 (
    echo   ... waiting for Next.js (%RETRY%/20)
    timeout /t 3 /nobreak >nul
    goto CHECK_LOOP
)

echo   OK  All servers ready!

echo.
echo [5/6] Starting Scheduler...
cd /d "%PROJECT_DIR%"
start "Scheduler" /min cmd /c ""%VENV_PYTHON%" scheduler.py --daemon"
echo   OK  Scheduler started

echo.
echo [6/6] Opening dashboard in Chrome...
start "" "%CHROME%" "%DASHBOARD_URL%"

echo.
echo  ========================================================
echo       Startup complete!
echo  ========================================================
echo.
echo   Dashboard: %DASHBOARD_URL%
echo   Flask API: http://localhost:5001
echo   Scheduler: Running (auto-update at 15:20, 16:00-16:30)
echo.
echo   Servers are running in minimized windows.
echo   You can close this window safely.
echo.
timeout /t 5 /nobreak >nul
