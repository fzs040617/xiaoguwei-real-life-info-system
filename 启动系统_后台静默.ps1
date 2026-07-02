$ErrorActionPreference = "Stop"

$Root = Split-Path -Parent $MyInvocation.MyCommand.Path
$Runtime = Join-Path $Root "_runtime"
$PidFile = Join-Path $Runtime "backend.pid"
$LogFile = Join-Path $Runtime "backend.log"
$LauncherLogFile = Join-Path $Runtime "launcher.log"
$Chrome = "C:\Program Files\Google\Chrome\Application\chrome.exe"
$ChromeX86 = "C:\Program Files (x86)\Google\Chrome\Application\chrome.exe"

New-Item -ItemType Directory -Force -Path $Runtime | Out-Null

$Backend = Get-ChildItem -Path $Root -Directory |
    Where-Object { Test-Path (Join-Path $_.FullName "app.py") } |
    Select-Object -First 1

if (-not $Backend) {
    throw "Cannot find backend app.py under project root."
}

$BackendPython = Join-Path $Backend.FullName ".venv\Scripts\python.exe"
if (-not (Test-Path $BackendPython)) {
    throw "Cannot find backend virtual environment Python: $BackendPython"
}

if (Test-Path $PidFile) {
    $OldPidText = (Get-Content -Path $PidFile -ErrorAction SilentlyContinue | Select-Object -First 1)
    $OldPid = 0
    if ([int]::TryParse($OldPidText, [ref]$OldPid)) {
        $OldProcess = Get-Process -Id $OldPid -ErrorAction SilentlyContinue
        if ($OldProcess) {
            Write-Host "Backend service is already running. PID: $OldPid"
            $Frontend = Get-ChildItem -Path $Root -Directory |
                Where-Object { Test-Path (Join-Path $_.FullName "index.html") } |
                Select-Object -First 1
            if ($Frontend) {
                $FrontendIndex = Join-Path $Frontend.FullName "index.html"
                $FrontendUrl = "file:///" + ($FrontendIndex -replace "\\", "/")
                if (Test-Path $Chrome) {
                    Start-Process -FilePath $Chrome -ArgumentList $FrontendUrl | Out-Null
                } elseif (Test-Path $ChromeX86) {
                    Start-Process -FilePath $ChromeX86 -ArgumentList $FrontendUrl | Out-Null
                } else {
                    Start-Process -FilePath $FrontendUrl | Out-Null
                }
            }
            exit 0
        }
    }
    Remove-Item -Path $PidFile -Force -ErrorAction SilentlyContinue
}

$Header = @(
    "==== XGW launcher ====",
    "Time: $(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')",
    "Backend: $($Backend.FullName)",
    "Command: $BackendPython -m uvicorn app:app --host 127.0.0.1 --port 8000",
    "Backend log: $LogFile",
    ""
)
Set-Content -Path $LauncherLogFile -Value $Header -Encoding UTF8

$BackendCommand = '/d /c ""' + $BackendPython + '" -m uvicorn app:app --host 127.0.0.1 --port 8000 >> "' + $LogFile + '" 2>&1"'
$Process = Start-Process -FilePath "cmd.exe" `
    -ArgumentList $BackendCommand `
    -WorkingDirectory $Backend.FullName `
    -WindowStyle Hidden `
    -PassThru

Set-Content -Path $PidFile -Value $Process.Id -Encoding ASCII

Start-Sleep -Seconds 3

$Listening = @(Get-NetTCPConnection -LocalAddress "127.0.0.1" -LocalPort 8000 -State Listen -ErrorAction SilentlyContinue)
if ($Listening.Count -eq 0) {
    Add-Content -Path $LauncherLogFile -Value "Backend may have failed to start. Port 8000 is not listening after launch check."
    Write-Host "Backend may have failed to start. Please check _runtime\backend.log"
    exit 1
}

Add-Content -Path $LauncherLogFile -Value "Backend started on 127.0.0.1:8000"

$Frontend = Get-ChildItem -Path $Root -Directory |
    Where-Object { Test-Path (Join-Path $_.FullName "index.html") } |
    Select-Object -First 1

if ($Frontend) {
    $FrontendIndex = Join-Path $Frontend.FullName "index.html"
    $FrontendUrl = "file:///" + ($FrontendIndex -replace "\\", "/")
    if (Test-Path $Chrome) {
        Start-Process -FilePath $Chrome -ArgumentList $FrontendUrl | Out-Null
    } elseif (Test-Path $ChromeX86) {
        Start-Process -FilePath $ChromeX86 -ArgumentList $FrontendUrl | Out-Null
    } else {
        Start-Process -FilePath $FrontendUrl | Out-Null
    }
}

Write-Host "Backend service started in background. PID: $($Process.Id)"
Write-Host "Backend started on 127.0.0.1:8000"
Write-Host "PID file: $PidFile"
Write-Host "Log file: $LogFile"
Write-Host "Launcher log file: $LauncherLogFile"
