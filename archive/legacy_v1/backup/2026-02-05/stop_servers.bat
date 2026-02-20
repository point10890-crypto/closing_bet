@echo off
chcp 65001 > nul
echo ============================================
echo   KR Market - 서버 종료
echo ============================================
echo.

echo [1/2] Next.js 서버 종료...
for /f "tokens=5" %%a in ('netstat -ano ^| findstr ":3000.*LISTENING"') do (
    taskkill /F /PID %%a 2>nul
)

echo [2/2] Flask 서버 종료...
for /f "tokens=5" %%a in ('netstat -ano ^| findstr ":5001.*LISTENING"') do (
    taskkill /F /PID %%a 2>nul
)

echo.
echo 서버 종료 완료!
echo.
pause
