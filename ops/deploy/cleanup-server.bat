@echo off
cd /d "%~dp0..\.."
set KEY=C:\Users\Admin\.ssh\codex_vps
set HOST=root@62.171.174.17
set SSHOPT=-i "%KEY%" -o StrictHostKeyChecking=accept-new -o BatchMode=yes -o ServerAliveInterval=30
scp %SSHOPT% ops\deploy\cleanup-server-remote.sh %HOST%:/tmp/momenti-cleanup.sh
if errorlevel 1 goto :err
echo.
echo ===== LISTA: cfare do te fshihet (ende asgje nuk fshihet) =====
ssh %SSHOPT% %HOST% "bash /tmp/momenti-cleanup.sh list"
if errorlevel 1 goto :err
echo.
set /p ANSWER=Shkruaj PO per te fshire keto, ose Enter per te anuluar: 
if /i not "%ANSWER%"=="PO" (
  echo Anuluar. Asgje nuk u fshi.
  goto :end
)
ssh %SSHOPT% %HOST% "bash /tmp/momenti-cleanup.sh run"
scp %SSHOPT% %HOST%:/tmp/momenti-cleanup-run.log ops\deploy\cleanup-server.log >nul 2>&1
:end
echo.
echo Shkruaj "u be" te Claude.
goto :eof
:err
echo Lidhja me serverin deshtoi. Shkruaj "u be" te Claude.
