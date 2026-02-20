@echo off
chcp 65001 >nul 2>&1
title MarketFlow - Stop All
echo ============================================================
echo   Stopping all MarketFlow services...
echo ============================================================

:: Kill Spring Boot (port 8080)
for /f "tokens=5" %%a in ('netstat -ano ^| findstr ":8080.*LISTENING"') do (
    echo   Killing Spring Boot PID %%a
    taskkill /F /PID %%a >nul 2>&1
)

:: Kill Next.js (port 4000)
for /f "tokens=5" %%a in ('netstat -ano ^| findstr ":4000.*LISTENING"') do (
    echo   Killing Next.js PID %%a
    taskkill /F /PID %%a >nul 2>&1
)

:: Kill Watchdog
for /f "tokens=2 delims=," %%a in ('tasklist /FI "IMAGENAME eq python.exe" /FO CSV /NH 2^>nul') do (
    wmic process where "processid=%%~a" get CommandLine 2>nul | findstr /C:"watchdog.py" >nul 2>&1 && (
        echo   Killing Watchdog PID %%~a
        taskkill /F /PID %%~a >nul 2>&1
    )
)

:: Kill ngrok
taskkill /F /IM ngrok.exe >nul 2>&1

timeout /t 2 /nobreak >nul
echo.
echo   All services stopped.
echo ============================================================
pause
