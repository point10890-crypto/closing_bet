@echo off
echo ============================================================
echo   KR Market - Closing Bet V2 Analysis
echo ============================================================
echo.

set "PROJECT_DIR=%~dp0"
if "%PROJECT_DIR:~-1%"=="\" set "PROJECT_DIR=%PROJECT_DIR:~0,-1%"
set "VENV_PYTHON=%PROJECT_DIR%\.venv\Scripts\python.exe"

cd /d "%PROJECT_DIR%"

echo [RUN] Closing Bet V2 AI Analysis...
echo.

"%VENV_PYTHON%" scheduler.py --jongga-v2

echo.
echo ============================================================
echo   Done! Result: data\jongga_v2_latest.json
echo ============================================================
pause
