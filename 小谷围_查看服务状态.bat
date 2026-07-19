@echo off
setlocal

echo =====================================
echo XGW system - WSL service status
echo =====================================

wsl -d Ubuntu -- bash -lc "PROJECT=/home/sean/projects/xgw; RUNTIME=$PROJECT/_runtime; echo '[backend 8000]'; pgrep -af '[u]vicorn app:app.*--port 8000' || echo not running; echo; echo '[frontend 5500]'; pgrep -af '[p]ython3 -m http.server 5500' || echo not running; echo; echo '[pid files]'; ls -l $RUNTIME/*.pid 2>/dev/null || echo no pid files; echo; echo '[ports]'; ss -ltnp 2>/dev/null | grep -E ':8000|:5500' || echo no 8000/5500 ports; echo; echo '[logs]'; ls -lh $RUNTIME/logs 2>/dev/null || echo no logs"

echo.
pause