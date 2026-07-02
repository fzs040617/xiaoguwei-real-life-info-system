@echo off
setlocal EnableExtensions

set "ROOT=%~dp0"
set "RUNTIME=%ROOT%_runtime"
set "PID_FILE=%RUNTIME%\backend.pid"
set "BACKEND_PID="
set "STOPPED="

echo Project root: %ROOT%
echo PID file: %PID_FILE%
echo.

if exist "%PID_FILE%" (
    set /p BACKEND_PID=<"%PID_FILE%"
)

if defined BACKEND_PID (
    powershell -NoProfile -ExecutionPolicy Bypass -Command "$p=Get-Process -Id %BACKEND_PID% -ErrorAction SilentlyContinue; if ($p) { exit 0 } else { exit 1 }"
    if not errorlevel 1 (
        echo Stopping backend service by PID: %BACKEND_PID%
        taskkill /PID %BACKEND_PID% /T /F >nul 2>nul
        if errorlevel 1 (
            echo Failed to stop backend service by PID: %BACKEND_PID%
            pause
            exit /b 1
        )
        set "STOPPED=1"
    ) else (
        echo PID file exists, but PID is not running: %BACKEND_PID%
    )
)

if not defined STOPPED (
    echo Checking port 8000 fallback...
    powershell -NoProfile -ExecutionPolicy Bypass -Command "$connections=@(Get-NetTCPConnection -LocalPort 8000 -State Listen -ErrorAction SilentlyContinue); if ($connections.Count -eq 0) { exit 2 }; $ids=$connections | Select-Object -ExpandProperty OwningProcess -Unique; foreach ($id in $ids) { if ($id -gt 0) { Write-Host ('Stopping process listening on port 8000. PID: ' + $id); & taskkill.exe /PID $id /T /F | Out-Null } }; exit 0"
    if not errorlevel 1 (
        set "STOPPED=1"
    )
)

if exist "%PID_FILE%" (
    del "%PID_FILE%" >nul 2>nul
)

if defined STOPPED (
    echo Backend service stopped.
) else (
    echo No running backend service was found.
)

pause
exit /b 0
