# ============================================================
# KR Market - 모든 서비스 종료
# ============================================================
# 실행: powershell -ExecutionPolicy Bypass -File stop_service.ps1
# ============================================================

[Console]::OutputEncoding = [System.Text.Encoding]::UTF8
$ProjectDir = $PSScriptRoot
$LockFile = Join-Path $ProjectDir "service_manager.lock"

Write-Host "============================================"
Write-Host "  KR Market - 서비스 종료"
Write-Host "============================================"

# 1. 포트 5001 (Flask) 종료
$flask = Get-NetTCPConnection -LocalPort 5001 -ErrorAction SilentlyContinue |
    Where-Object { $_.State -eq 'Listen' }
foreach ($conn in $flask) {
    Stop-Process -Id $conn.OwningProcess -Force -ErrorAction SilentlyContinue
    Write-Host "  Flask 종료 (PID: $($conn.OwningProcess))"
}

# 2. 포트 4000 (Next.js) 종료
$next = Get-NetTCPConnection -LocalPort 4000 -ErrorAction SilentlyContinue |
    Where-Object { $_.State -eq 'Listen' }
foreach ($conn in $next) {
    # Next.js 자식 node 프로세스도 종료
    Get-CimInstance Win32_Process -ErrorAction SilentlyContinue |
        Where-Object { $_.ParentProcessId -eq $conn.OwningProcess } |
        ForEach-Object {
            Stop-Process -Id $_.ProcessId -Force -ErrorAction SilentlyContinue
        }
    Stop-Process -Id $conn.OwningProcess -Force -ErrorAction SilentlyContinue
    Write-Host "  Next.js 종료 (PID: $($conn.OwningProcess))"
}

# 3. 스케줄러 Python 프로세스 종료
Get-CimInstance Win32_Process -ErrorAction SilentlyContinue |
    Where-Object { $_.CommandLine -like "*scheduler.py*--daemon*" } |
    ForEach-Object {
        Stop-Process -Id $_.ProcessId -Force -ErrorAction SilentlyContinue
        Write-Host "  스케줄러 종료 (PID: $($_.ProcessId))"
    }

# 4. 서비스 매니저 자체 종료
Get-CimInstance Win32_Process -ErrorAction SilentlyContinue |
    Where-Object { $_.CommandLine -like "*service_manager.ps1*" -and $_.ProcessId -ne $PID } |
    ForEach-Object {
        Stop-Process -Id $_.ProcessId -Force -ErrorAction SilentlyContinue
        Write-Host "  서비스 매니저 종료 (PID: $($_.ProcessId))"
    }

# 5. Lock 파일 삭제
if (Test-Path $LockFile) {
    Remove-Item $LockFile -Force
}

Write-Host ""
Write-Host "  모든 서비스가 종료되었습니다."
Write-Host "============================================"
