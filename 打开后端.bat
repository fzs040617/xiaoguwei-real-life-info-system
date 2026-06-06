@echo off
setlocal
title XGW Backend

set "ROOT=%~dp0"
set "BACKEND="
set "FRONTEND_INDEX="

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

if defined FRONTEND_INDEX (
    echo Opening frontend index.html...
    start "" "%FRONTEND_INDEX%"
) else (
    echo WARNING: Cannot find frontend index.html.
    echo Backend startup will continue.
)

echo.
echo Backend folder:
echo %BACKEND%
echo.

cd /d "%BACKEND%"

echo Starting backend with py...
echo API docs: http://127.0.0.1:8000/docs
echo.

py -m uvicorn app:app --reload --host 127.0.0.1 --port 8000

if errorlevel 1 (
    echo.
    echo WARNING: py command failed. Trying python...
    echo.
    python -m uvicorn app:app --reload --host 127.0.0.1 --port 8000
)

echo.
echo Backend process ended.
pause
