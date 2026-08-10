@echo off
setlocal
cd /d "%~dp0"
set PORT=8765
set URL=http://127.0.0.1:%PORT%/index.html

where py >nul 2>nul
if %errorlevel%==0 (
  start "Game Hub Server" /min py -m http.server %PORT% --bind 127.0.0.1
) else (
  where python >nul 2>nul
  if errorlevel 1 (
    start "Ludotheque Server" /min powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0Lancer le Hub Windows.ps1" -Port %PORT%
  ) else (
    start "Game Hub Server" /min python -m http.server %PORT% --bind 127.0.0.1
  )
)

timeout /t 2 /nobreak >nul
start "" "%URL%"
exit /b 0
