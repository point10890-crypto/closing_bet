@echo off
setlocal enabledelayedexpansion

:: ============================================================
:: KR Market Scheduler - Auto run and recovery script
:: ============================================================
:: This script runs the scheduler and auto-restarts on error.
:: Register in Windows Task Scheduler for auto-start on boot.
:: ============================================================

set "PROJECT_DIR=%~dp0"
if "%PROJECT_DIR:~-1%"=="\" set "PROJECT_DIR=%PROJECT_DIR:~0,-1%"
set "VENV_PYTHON=%PROJECT_DIR%\.venv\Scripts\python.exe"
set "LOG_DIR=%PROJECT_DIR%\logs"
set "LOCK_FILE=%PROJECT_DIR%\scheduler.lock"
set "MAX_RETRIES=5"
set "RETRY_DELAY=60"

:: Create log directory
if not exist "%LOG_DIR%" mkdir "%LOG_DIR%"

:: Log file setup
for /f "tokens=1-3 delims=/ " %%a in ('date /t') do set "DATE=%%a%%b%%c"
for /f "tokens=1-2 delims=: " %%a in ('time /t') do set "TIME=%%a%%b"
set "LOG_FILE=%LOG_DIR%\scheduler_%DATE%.log"

:: Prevent duplicate execution
if exist "%LOCK_FILE%" (
    echo [%date% %time%] Scheduler already running. >> "%LOG_FILE%"

    :: Delete lock file if older than 1 hour (zombie process)
    for /f %%A in ('powershell -command "(Get-Item '%LOCK_FILE%').LastWriteTime -lt (Get-Date).AddHours(-1)"') do (
        if "%%A"=="True" (
            echo [%date% %time%] Removing stale lock file >> "%LOG_FILE%"
            del "%LOCK_FILE%"
        ) else (
            exit /b 0
        )
    )
)

:: Create lock file
echo %date% %time% > "%LOCK_FILE%"

echo ============================================================ >> "%LOG_FILE%"
echo [%date% %time%] KR Market Scheduler Start >> "%LOG_FILE%"
echo ============================================================ >> "%LOG_FILE%"

cd /d "%PROJECT_DIR%"

set "RETRY_COUNT=0"

:MAIN_LOOP
set /a RETRY_COUNT+=1

echo [%date% %time%] Scheduler attempt (%RETRY_COUNT%/%MAX_RETRIES%) >> "%LOG_FILE%"

:: Run scheduler
"%VENV_PYTHON%" scheduler.py --daemon >> "%LOG_FILE%" 2>&1
set "EXIT_CODE=%ERRORLEVEL%"

echo [%date% %time%] Scheduler stopped (Exit Code: %EXIT_CODE%) >> "%LOG_FILE%"

:: Normal exit
if %EXIT_CODE%==0 (
    echo [%date% %time%] Normal exit >> "%LOG_FILE%"
    goto :CLEANUP
)

:: Error - restart
if %RETRY_COUNT% LSS %MAX_RETRIES% (
    echo [%date% %time%] Error! Restarting in %RETRY_DELAY% seconds... >> "%LOG_FILE%"
    timeout /t %RETRY_DELAY% /nobreak > nul

    :: Refresh lock file
    echo %date% %time% > "%LOCK_FILE%"

    goto :MAIN_LOOP
)

:: Max retries exceeded
echo [%date% %time%] Max retries exceeded. Manual check required! >> "%LOG_FILE%"

:: Send Telegram alert (failure notification)
"%VENV_PYTHON%" -c "from scheduler import send_telegram; send_telegram('KR Market Scheduler failed after %MAX_RETRIES% retries. Manual check required.')" >> "%LOG_FILE%" 2>&1

:CLEANUP
:: Delete lock file
if exist "%LOCK_FILE%" del "%LOCK_FILE%"

echo [%date% %time%] Script exit >> "%LOG_FILE%"
endlocal
