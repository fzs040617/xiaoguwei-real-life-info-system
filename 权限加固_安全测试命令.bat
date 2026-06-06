@echo off
setlocal
title XGW Permission Hardening Safe Tests

echo XGW Permission Hardening Safe Tests
echo.
echo This script only uses bad token and future dates.
echo It does NOT delete data, import backups, clear real history, or modify the database.
echo.
echo If requests fail with connection errors, start the backend first:
echo   Double-click the backend starter bat in the project root.
echo.

echo [1/2] Test: GET /backup/export?token=bad
powershell -NoProfile -ExecutionPolicy Bypass -Command "$u='http://127.0.0.1:8000/backup/export?token=bad'; try { $r=Invoke-WebRequest -Uri $u -Method GET -UseBasicParsing; Write-Host ('STATUS: '+[int]$r.StatusCode); Write-Host 'BODY:'; Write-Host $r.Content } catch { $resp=$_.Exception.Response; if ($resp) { $status=[int]$resp.StatusCode; $sr=New-Object IO.StreamReader($resp.GetResponseStream()); $body=$sr.ReadToEnd(); Write-Host ('STATUS: '+$status); Write-Host 'BODY:'; Write-Host $body } else { Write-Host 'REQUEST FAILED:'; Write-Host $_.Exception.Message; Write-Host 'Backend may not be running. Start the backend starter bat first.' } }"
echo.

echo [2/2] Test: DELETE /update-history/clear-range-admin with bad token and future dates
powershell -NoProfile -ExecutionPolicy Bypass -Command "$confirm=([string][char]28165)+([string][char]31354)+([string][char]21382)+([string][char]21490); $body=@{token='bad'; system_password='xgw2026'; confirm_text=$confirm; start_date='2099-01-01'; end_date='2099-01-02'} | ConvertTo-Json; $u='http://127.0.0.1:8000/update-history/clear-range-admin'; try { $r=Invoke-WebRequest -Uri $u -Method DELETE -ContentType 'application/json; charset=utf-8' -Body $body -UseBasicParsing; Write-Host ('STATUS: '+[int]$r.StatusCode); Write-Host 'BODY:'; Write-Host $r.Content } catch { $resp=$_.Exception.Response; if ($resp) { $status=[int]$resp.StatusCode; $sr=New-Object IO.StreamReader($resp.GetResponseStream()); $bodyText=$sr.ReadToEnd(); Write-Host ('STATUS: '+$status); Write-Host 'BODY:'; Write-Host $bodyText } else { Write-Host 'REQUEST FAILED:'; Write-Host $_.Exception.Message; Write-Host 'Backend may not be running. Start the backend starter bat first.' } }"
echo.

echo Expected result:
echo - Both tests should return 401 or 403.
echo - The backup JSON should NOT be returned.
echo - No update history should be deleted.
echo.
pause
