@echo off
setlocal EnableDelayedExpansion
cd /d "%~dp0"
set PORT=8765
set PROTOCOL=http
set TLS_ARGS=
if exist "%~dp0.runtime\tls\lan.crt" if exist "%~dp0.runtime\tls\lan.key" (
  set PROTOCOL=https
  set TLS_ARGS=--cert "%~dp0.runtime\tls\lan.crt" --key "%~dp0.runtime\tls\lan.key"
)
where py >nul 2>nul
if %errorlevel%==0 (
  for /f %%P in ('py server\lan_server.py --find-port --port %PORT%') do set PORT=%%P
  start "Ludotheque LAN" cmd /k py server\lan_server.py --port !PORT! --root "%~dp0" !TLS_ARGS!
  timeout /t 2 /nobreak >nul
  start "" "!PROTOCOL!://127.0.0.1:!PORT!/index.html"
  exit /b 0
)

where python >nul 2>nul
if errorlevel 1 (
  echo Python 3 est necessaire pour heberger les salons LAN.
  pause
  exit /b 1
)

for /f %%P in ('python server\lan_server.py --find-port --port %PORT%') do set PORT=%%P
start "Ludotheque LAN" cmd /k python server\lan_server.py --port !PORT! --root "%~dp0" !TLS_ARGS!
timeout /t 2 /nobreak >nul
start "" "!PROTOCOL!://127.0.0.1:!PORT!/index.html"
exit /b 0
