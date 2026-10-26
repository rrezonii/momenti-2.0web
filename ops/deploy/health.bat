@echo off
cd /d "%~dp0..\.."
set KEY=C:\Users\Admin\.ssh\codex_vps
set HOST=root@62.171.174.17
set SSHOPT=-i "%KEY%" -o StrictHostKeyChecking=accept-new -o BatchMode=yes -o ServerAliveInterval=30
scp %SSHOPT% ops\deploy\health-remote.sh %HOST%:/tmp/momenti-health.sh
if errorlevel 1 goto :err
ssh %SSHOPT% %HOST% "bash /tmp/momenti-health.sh"
scp %SSHOPT% %HOST%:/tmp/momenti-health.log ops\deploy\health.log >nul 2>&1
echo.
echo Shkruaj "u be" te Claude.
goto :eof
:err
echo Lidhja me serverin deshtoi. Shkruaj "u be" te Claude.
