@echo off
title MarketFlow - Stop All Services
color 0C

echo.
echo  ========================================================
echo       MarketFlow - Stop All Services
echo  ========================================================
echo.

set "PROJECT_DIR=%~dp0"
if "%PROJECT_DIR:~-1%"=="\" set "PROJECT_DIR=%PROJECT_DIR:~0,-1%"

echo [1/4] Stopping Next.js (port 4000)...
for /f "tokens=5" %%a in ('netstat -ano 2^>nul ^| findstr ":4000.*LISTENING"') do (
    taskkill /F /PID %%a >nul 2>&1
    echo   OK  Next.js stopped (PID: %%a)
)

echo [2/4] Stopping Spring Boot (port 8080)...
for /f "tokens=5" %%a in ('netstat -ano 2^>nul ^| findstr ":8080.*LISTENING"') do (
    taskkill /F /PID %%a >nul 2>&1
    echo   OK  Spring Boot stopped (PID: %%a)
)

echo [3/4] Stopping watchdog + ngrok...
wmic process where "commandline like '%%watchdog.py%%'" delete >nul 2>&1
taskkill /F /IM ngrok.exe >nul 2>&1

echo [4/4] Cleaning up lock files...
if exist "%PROJECT_DIR%\scheduler.lock" del "%PROJECT_DIR%\scheduler.lock"
if exist "%PROJECT_DIR%\service_manager.lock" del "%PROJECT_DIR%\service_manager.lock"

echo.
echo  ========================================================
echo       All services stopped!
echo  ========================================================
echo.
timeout /t 3 /nobreak > nul
exit
