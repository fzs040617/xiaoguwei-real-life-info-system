@echo off
setlocal
title XGW Backend

set "ROOT=%~dp0"
set "BACKEND="
set "FRONTEND_INDEX="
set "FRONTEND_URL="
set "BACKEND_PYTHON="
set "CHROME=C:\Program Files\Google\Chrome\Application\chrome.exe"

echo Project root:
echo %ROOT%
echo.

for /d %%D in ("%ROOT%01_*") do (
    if exist "%%~fD\app.py" (
        set "BACKEND=%%~fD"
    )
)

if not defined BACKEND (
    echo ERROR: Cannot find backend app.py.
    echo This bat file may not be in the project root folder.
    echo Expected backend folder: 01_*
    echo.
    pause
    exit /b 1
)

for /d %%F in ("%ROOT%02_*") do (
    if exist "%%~fF\index.html" (
        set "FRONTEND_INDEX=%%~fF\index.html"
    )
)

echo.
echo Backend folder:
echo %BACKEND%
echo.

set "BACKEND_PYTHON=%BACKEND%\.venv\Scripts\python.exe"

if not exist "%BACKEND_PYTHON%" (
    echo ERROR: Backend virtual environment Python was not found.
    echo Expected: %BACKEND_PYTHON%
    echo Please confirm the backend .venv folder exists under the backend folder.
    echo.
    pause
    exit /b 1
)

if not exist "%CHROME%" set "CHROME=C:\Program Files (x86)\Google\Chrome\Application\chrome.exe"

if defined FRONTEND_INDEX (
    set "FRONTEND_URL=file:///%FRONTEND_INDEX:\=/%"
) else (
    echo WARNING: Cannot find frontend index.html.
    echo Browser auto-open will be skipped.
)

echo Starting backend with project virtual environment Python in a new window...
echo API docs: http://127.0.0.1:8000/docs
echo.

start "XGW Backend" /D "%BACKEND%" cmd /k call "%BACKEND_PYTHON%" -m uvicorn app:app --reload --host 127.0.0.1 --port 8000

echo.
echo Waiting for backend startup before opening the homepage...
timeout /t 3 /nobreak >nul

if defined FRONTEND_URL (
    echo Opening homepage:
    echo %FRONTEND_URL%
    if exist "%CHROME%" (
        start "" "%CHROME%" "%FRONTEND_URL%"
    ) else (
        echo Chrome was not found in the common install paths. Using the default browser instead.
        start "" "%FRONTEND_URL%"
    )
)

echo.
echo Backend is running in the separate window titled XGW Backend.
echo You can close this launcher window.
pause
