@echo off
chcp 65001 >nul
cd /d "%~dp0"
title Cuoc Thi - Server + Tunnel

:: Cach dung:
::   start-quiz.cmd                  -> build (neu can) + server + quick tunnel (URL tam)
::   start-quiz.cmd <hostname>       -> build (neu can) + server + named tunnel (da tao truoc)
::   start-quiz.cmd rebuild          -> bat buoc build lai, roi chay quick tunnel
::   start-quiz.cmd rebuild <host>   -> bat buoc build lai, roi chay named tunnel

set "HOST="
if /i "%~1"=="rebuild" (
  echo [1/4] Rebuild client...
  call npm run build || goto :err
  set "HOST=%~2"
) else (
  set "HOST=%~1"
)

if /i "%HOST%"=="rebuild" set "HOST="
if not exist "client\dist\index.html" (
  echo [1/4] Client chua build - build lan dau...
  call npm run build || goto :err
) else (
  echo [1/4] Client da build san.
)

:: Bat server (cua so rieng, giu log)
echo [2/4] Khoi dong server tren port 3001...
start "cuoc-thi-server" cmd /k "call npm start"

:: Cho server san sang
echo [3/4] Cho server san sang...
powershell -NoProfile -Command "$ok=$false; for($i=0;$i -lt 40;$i++){ try { Invoke-WebRequest -Uri 'http://localhost:3001/api/health' -UseBasicParsing -ErrorAction Stop | Out-Null; $ok=$true; break } catch { Start-Sleep -Milliseconds 1000 } }; if(-not $ok){ exit 1 }" || goto :err

:: Tunnel
set "CLOUD=cloudflared"
where cloudflared >nul 2>&1 || set "CLOUD=C:\Program Files (x86)\cloudflared\cloudflared.exe"

if "%HOST%"=="" (
  echo [4/4] Quick tunnel (URL tam, doi url tai day). GIU cua so nay mo.
  "%CLOUD%" tunnel --url http://localhost:3001
) else (
  echo [4/4] Named tunnel: %HOST%  (nho da chay `cloudflared tunnel create` truoc)
  "%CLOUD%" tunnel --url http://localhost:3001 run %HOST%
)
goto :eof

:err
echo.
echo  LOI: build/start that bai. Xem chi tiet phia tren, roi an phim bat ky de dong.
pause >nul