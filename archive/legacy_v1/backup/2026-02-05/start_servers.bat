@echo off
chcp 65001 > nul
title KR Market Servers

echo ============================================
echo   KR Market - 서버 시작
echo ============================================
echo.

set "PROJECT_DIR=C:\Users\dynas\OneDrive\바탕 화면\kr_market_package"

:: Flask 서버 확인 및 시작
echo [1/2] Flask 서버 시작 (5001)...
cd /d "%PROJECT_DIR%"
start "Flask Server" cmd /k "cd /d "%PROJECT_DIR%" && .venv\Scripts\python.exe flask_app.py"

timeout /t 3 /nobreak > nul

:: Next.js 서버 시작
echo [2/2] Next.js 서버 시작 (3000)...
cd /d "%PROJECT_DIR%\frontend"
start "Next.js Server" cmd /k "cd /d "%PROJECT_DIR%\frontend" && npm run dev"

echo.
echo ============================================
echo   서버 시작 완료!
echo ============================================
echo.
echo   Flask:   http://localhost:5001
echo   Next.js: http://localhost:3000
echo.
echo   대시보드: http://localhost:3000/dashboard/kr/overview
echo.
echo   [참고] 이 창을 닫아도 서버는 계속 실행됩니다.
echo   서버를 종료하려면 stop_servers.bat 실행
echo.
pause
