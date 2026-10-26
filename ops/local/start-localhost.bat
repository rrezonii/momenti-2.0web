@echo off
cd /d "%~dp0..\.."
echo == Marr ndryshimet e fundit nga GitHub...
git pull --ff-only
if errorlevel 1 (
  echo.
  echo XXX git pull nuk u krye: ke ndryshime ne PC qe nuk jane ne GitHub. Shkruaj te Claude.
  pause
  exit /b 1
)
echo == Kontrolloj paketat (vetem nese kane ndryshuar)...
call npm.cmd install --no-audit --no-fund
echo == Nis localhost: http://localhost:3001/kycu/artikuj
call npm.cmd run dev:local
