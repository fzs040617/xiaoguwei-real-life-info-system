@echo off
setlocal
set "ROOT=%~dp0"
set "SCRIPT=%~dpn0.ps1"

if not exist "%SCRIPT%" (
    echo ERROR: Cannot find helper script:
    echo %SCRIPT%
    pause
    exit /b 1
)

powershell -NoProfile -ExecutionPolicy Bypass -File "%SCRIPT%"
if errorlevel 1 (
    echo.
    echo Start failed. Please check _runtime\backend.log if it exists.
    pause
    exit /b 1
)

exit /b 0
