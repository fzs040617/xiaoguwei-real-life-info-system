@echo off
setlocal
echo =====================================
echo XGW system - start
echo =====================================

wsl -d Ubuntu -- /home/sean/projects/xgw/start_xgw.sh

echo.
echo Waiting for frontend server...
timeout /t 5 >nul

set URL=http://localhost:5500/index.html

set CHROME1=C:\Program Files\Google\Chrome\Application\chrome.exe
set CHROME2=C:\Program Files (x86)\Google\Chrome\Application\chrome.exe
set CHROME3=%LOCALAPPDATA%\Google\Chrome\Application\chrome.exe

if exist "%CHROME1%" (
    start "" "%CHROME1%" "%URL%"
) else if exist "%CHROME2%" (
    start "" "%CHROME2%" "%URL%"
) else if exist "%CHROME3%" (
    start "" "%CHROME3%" "%URL%"
) else (
    echo Chrome not found, opening with default browser...
    start "" "%URL%"
)

echo.
echo Frontend: http://localhost:5500/index.html
echo Backend : http://localhost:8000/docs
echo.
timeout /t 5 >nul