# ============================================================
# KR Market Scheduler - PowerShell 자동 실행 스크립트
# ============================================================
# 이 스크립트는 스케줄러를 실행하고, 에러 발생 시 자동 재시작합니다.
# Windows 작업 스케줄러에서 이 스크립트를 실행하도록 설정하세요.
# ============================================================

$ErrorActionPreference = "Continue"
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8

# 설정
$ProjectDir = $PSScriptRoot
$VenvPython = "$ProjectDir\.venv\Scripts\python.exe"
$LogDir = "$ProjectDir\logs"
$LockFile = "$ProjectDir\scheduler.lock"
$MaxRetries = 5
$RetryDelay = 60  # 초

# 로그 디렉토리 생성
if (-not (Test-Path $LogDir)) {
    New-Item -ItemType Directory -Path $LogDir -Force | Out-Null
}

# 로그 파일
$DateStr = Get-Date -Format "yyyyMMdd"
$LogFile = "$LogDir\scheduler_$DateStr.log"

function Write-Log {
    param([string]$Message)
    $Timestamp = Get-Date -Format "yyyy-MM-dd HH:mm:ss"
    $LogEntry = "[$Timestamp] $Message"
    Add-Content -Path $LogFile -Value $LogEntry -Encoding UTF8
    Write-Host $LogEntry
}

function Send-TelegramAlert {
    param([string]$Message)
    try {
        & $VenvPython -c "from scheduler import send_telegram; send_telegram('$Message')" 2>&1 | Out-Null
    } catch {
        Write-Log "텔레그램 전송 실패: $_"
    }
}

# 중복 실행 방지
if (Test-Path $LockFile) {
    $LockAge = (Get-Date) - (Get-Item $LockFile).LastWriteTime
    if ($LockAge.TotalHours -lt 1) {
        Write-Log "이미 실행 중인 스케줄러가 있습니다. 종료합니다."
        exit 0
    } else {
        Write-Log "오래된 Lock 파일 삭제"
        Remove-Item $LockFile -Force
    }
}

# Lock 파일 생성
Get-Date | Out-File $LockFile -Encoding UTF8

Write-Log "============================================================"
Write-Log "KR Market Scheduler 시작"
Write-Log "Project: $ProjectDir"
Write-Log "Python: $VenvPython"
Write-Log "============================================================"

Set-Location $ProjectDir
$env:PYTHONIOENCODING = "utf-8"
$env:PYTHONPATH = $ProjectDir

$RetryCount = 0

while ($RetryCount -lt $MaxRetries) {
    $RetryCount++
    Write-Log "스케줄러 실행 시도 ($RetryCount/$MaxRetries)"

    try {
        # 스케줄러 실행
        $Process = Start-Process -FilePath $VenvPython -ArgumentList "scheduler.py", "--daemon" -NoNewWindow -PassThru -Wait -RedirectStandardOutput "$LogDir\scheduler_stdout.log" -RedirectStandardError "$LogDir\scheduler_stderr.log"
        $ExitCode = $Process.ExitCode

        Write-Log "스케줄러 종료 (Exit Code: $ExitCode)"

        # 정상 종료
        if ($ExitCode -eq 0) {
            Write-Log "정상 종료"
            break
        }

    } catch {
        Write-Log "예외 발생: $_"
        $ExitCode = 1
    }

    # 에러 발생 시 재시작
    if ($RetryCount -lt $MaxRetries) {
        Write-Log "에러 발생! ${RetryDelay}초 후 재시작..."
        Start-Sleep -Seconds $RetryDelay

        # Lock 파일 갱신
        Get-Date | Out-File $LockFile -Encoding UTF8
    }
}

# 최대 재시도 초과
if ($RetryCount -ge $MaxRetries -and $ExitCode -ne 0) {
    Write-Log "최대 재시도 횟수 초과. 관리자 확인 필요!"
    Send-TelegramAlert "❌ KR Market 스케줄러가 ${MaxRetries}회 재시도 후에도 실패했습니다. 수동 확인이 필요합니다."
}

# Lock 파일 삭제
if (Test-Path $LockFile) {
    Remove-Item $LockFile -Force
}

Write-Log "스크립트 종료"
