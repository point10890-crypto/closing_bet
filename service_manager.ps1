# KR Market - Service Manager
# Starts Flask + Next.js + Scheduler, restarts if down

$ErrorActionPreference = "Continue"

$PROJECT   = $PSScriptRoot
$PYTHON    = Join-Path $PROJECT ".venv\Scripts\python.exe"
$FRONTEND  = Join-Path $PROJECT "frontend"
$LOGDIR    = Join-Path $PROJECT "logs"

if (-not (Test-Path $LOGDIR)) { New-Item -ItemType Directory -Path $LOGDIR -Force | Out-Null }

function Log($msg) {
    $line = "[$(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')] $msg"
    $logPath = Join-Path $LOGDIR "service_$(Get-Date -Format 'yyyyMMdd').log"
    Add-Content -Path $logPath -Value $line -Encoding UTF8
    Write-Host $line
}

function Kill-Port($port) {
    Get-NetTCPConnection -LocalPort $port -ErrorAction SilentlyContinue |
        Where-Object { $_.State -eq 'Listen' } |
        ForEach-Object { Stop-Process -Id $_.OwningProcess -Force -ErrorAction SilentlyContinue }
}

function Is-PortOpen($port) {
    try {
        $c = New-Object System.Net.Sockets.TcpClient
        $c.Connect("localhost", $port)
        $c.Close()
        return $true
    } catch {
        return $false
    }
}

# Lock check
$lockFile = Join-Path $PROJECT "service_manager.lock"
if (Test-Path $lockFile) {
    $age = (Get-Date) - (Get-Item $lockFile).LastWriteTime
    if ($age.TotalMinutes -lt 5) {
        Log "Already running. Exit."
        exit 0
    }
    Remove-Item $lockFile -Force
}
Get-Date | Out-File $lockFile -Encoding UTF8

Log "=========================================="
Log "KR Market Service Manager Start"
Log "  Project:  $PROJECT"
Log "  Python:   $PYTHON"
Log "  Frontend: $FRONTEND"
Log "=========================================="

# Start Flask
Kill-Port 5001
Start-Sleep 1
$env:PYTHONIOENCODING = "utf-8"
$env:PYTHONPATH = $PROJECT
Log "Starting Flask (port 5001)..."
$flask = Start-Process -FilePath $PYTHON -ArgumentList "flask_app.py" `
    -WorkingDirectory $PROJECT -NoNewWindow -PassThru `
    -RedirectStandardOutput "$LOGDIR\flask_out.log" `
    -RedirectStandardError "$LOGDIR\flask_err.log"
Log "Flask PID: $($flask.Id)"
Start-Sleep 5

# Start Next.js
Kill-Port 4000
Start-Sleep 1
Log "Starting Next.js (port 4000)..."
$next = Start-Process -FilePath "cmd.exe" -ArgumentList "/c","npm start" `
    -WorkingDirectory $FRONTEND -NoNewWindow -PassThru `
    -RedirectStandardOutput "$LOGDIR\next_out.log" `
    -RedirectStandardError "$LOGDIR\next_err.log"
Log "Next.js PID: $($next.Id)"
Start-Sleep 15

# Start Scheduler
Log "Starting Scheduler..."
$sched = Start-Process -FilePath $PYTHON -ArgumentList "scheduler.py","--daemon" `
    -WorkingDirectory $PROJECT -NoNewWindow -PassThru `
    -RedirectStandardOutput "$LOGDIR\sched_out.log" `
    -RedirectStandardError "$LOGDIR\sched_err.log"
Log "Scheduler PID: $($sched.Id)"
Start-Sleep 3

# Initial status
$f = Is-PortOpen 5001
$n = Is-PortOpen 4000
$fs = "FAIL"; if ($f) { $fs = "OK" }
$ns = "FAIL"; if ($n) { $ns = "OK" }
Log "Status: Flask=$fs Next.js=$ns Scheduler=PID:$($sched.Id)"

# Watch loop - check every 2 minutes
Log "Watch loop started (2min interval)"
while ($true) {
    Start-Sleep 120

    Get-Date | Out-File $lockFile -Encoding UTF8

    if (-not (Is-PortOpen 5001)) {
        Log "Flask DOWN - restarting..."
        Kill-Port 5001
        Start-Sleep 2
        $flask = Start-Process -FilePath $PYTHON -ArgumentList "flask_app.py" `
            -WorkingDirectory $PROJECT -NoNewWindow -PassThru `
            -RedirectStandardOutput "$LOGDIR\flask_out.log" `
            -RedirectStandardError "$LOGDIR\flask_err.log"
        Log "Flask restarted (PID: $($flask.Id))"
        Start-Sleep 5
    }

    if (-not (Is-PortOpen 4000)) {
        Log "Next.js DOWN - restarting..."
        Kill-Port 4000
        Start-Sleep 2
        $next = Start-Process -FilePath "cmd.exe" -ArgumentList "/c","npm start" `
            -WorkingDirectory $FRONTEND -NoNewWindow -PassThru `
            -RedirectStandardOutput "$LOGDIR\next_out.log" `
            -RedirectStandardError "$LOGDIR\next_err.log"
        Log "Next.js restarted (PID: $($next.Id))"
        Start-Sleep 15
    }

    if ($sched.HasExited) {
        Log "Scheduler DOWN - restarting..."
        $sched = Start-Process -FilePath $PYTHON -ArgumentList "scheduler.py","--daemon" `
            -WorkingDirectory $PROJECT -NoNewWindow -PassThru `
            -RedirectStandardOutput "$LOGDIR\sched_out.log" `
            -RedirectStandardError "$LOGDIR\sched_err.log"
        Log "Scheduler restarted (PID: $($sched.Id))"
    }
}
