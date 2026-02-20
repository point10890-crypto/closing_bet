@echo off
echo ============================================================
echo   KR Market - VCP Signal Scan
echo ============================================================
echo.

set "PROJECT_DIR=%~dp0"
if "%PROJECT_DIR:~-1%"=="\" set "PROJECT_DIR=%PROJECT_DIR:~0,-1%"
set "VENV_PYTHON=%PROJECT_DIR%\.venv\Scripts\python.exe"

cd /d "%PROJECT_DIR%"

echo [RUN] VCP + Smart Money Signal Scan...
echo.

"%VENV_PYTHON%" scheduler.py --signals

echo.
echo ============================================================
echo   Done! Result: data\signals_log.csv
echo ============================================================
pause
