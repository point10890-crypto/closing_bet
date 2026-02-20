chcp 65001 | Out-Null
$WshShell = New-Object -ComObject WScript.Shell
$Desktop = $WshShell.SpecialFolders("Desktop")

# 1. Dashboard Launcher
$Shortcut = $WshShell.CreateShortcut("$Desktop\Closing Bet Dashboard.lnk")
$Shortcut.TargetPath = Join-Path $PSScriptRoot "launch_dashboard.bat"
$Shortcut.WorkingDirectory = $PSScriptRoot
$Shortcut.Description = "KR Market Smart Money Dashboard"
$Shortcut.IconLocation = "C:\Windows\System32\shell32.dll,43"
$Shortcut.Save()
Write-Host "[OK] Closing Bet Dashboard shortcut created"

# 2. Stop All
$Shortcut = $WshShell.CreateShortcut("$Desktop\Closing Bet Stop.lnk")
$Shortcut.TargetPath = Join-Path $PSScriptRoot "stop_all_services.bat"
$Shortcut.WorkingDirectory = $PSScriptRoot
$Shortcut.Description = "Stop all KR Market services"
$Shortcut.IconLocation = "C:\Windows\System32\shell32.dll,132"
$Shortcut.Save()
Write-Host "[OK] Closing Bet Stop shortcut created"

Write-Host ""
Write-Host "Desktop shortcuts created successfully!"
