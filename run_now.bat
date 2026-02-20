@echo off
echo ============================================================
echo   KR Market - Run Full Update Now
echo ============================================================
echo.

set "PROJECT_DIR=%~dp0"
if "%PROJECT_DIR:~-1%"=="\" set "PROJECT_DIR=%PROJECT_DIR:~0,-1%"
set "VENV_PYTHON=%PROJECT_DIR%\.venv\Scripts\python.exe"

cd /d "%PROJECT_DIR%"

echo [RUN] Full update (Price + Institutional + VCP + ClosingBet + Report)
echo.

"%VENV_PYTHON%" scheduler.py --now

echo.
echo ============================================================
echo   Done!
echo ============================================================
pause
