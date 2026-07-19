@echo off
setlocal

echo =====================================
echo XGW system - stop WSL background services
echo =====================================

wsl -d Ubuntu -- bash -lc "PROJECT=/home/sean/projects/xgw; RUNTIME=$PROJECT/_runtime; echo stop backend 8000; if [ -f $RUNTIME/backend.pid ]; then kill $(cat $RUNTIME/backend.pid) 2>/dev/null || true; rm -f $RUNTIME/backend.pid; fi; pkill -f '[u]vicorn app:app.*--port 8000' 2>/dev/null || true; echo stop frontend 5500; if [ -f $RUNTIME/frontend.pid ]; then kill $(cat $RUNTIME/frontend.pid) 2>/dev/null || true; rm -f $RUNTIME/frontend.pid; fi; pkill -f '[p]ython3 -m http.server 5500' 2>/dev/null || true; echo done"

echo.
timeout /t 2 >nul