@echo off
cd /d "%~dp0..\.."
set KEY=C:\Users\Admin\.ssh\codex_vps
set HOST=root@62.171.174.17
set SSHOPT=-i "%KEY%" -o StrictHostKeyChecking=accept-new -o BatchMode=yes -o ServerAliveInterval=30
echo == Paketoj kodin...
if exist out\momenti-src.tar.gz del out\momenti-src.tar.gz
if not exist out mkdir out
tar -czf out\momenti-src.tar.gz --exclude=*.log --exclude=__pycache__ --exclude=*.pyc --exclude=.kfl-* --exclude=weights --exclude=globals.css.before-* app components lib public scripts ops proxy.ts next.config.ts package.json postcss.config.mjs eslint.config.mjs
if errorlevel 1 goto :err
echo == Dergoj ne server...
scp %SSHOPT% out\momenti-src.tar.gz %HOST%:/tmp/momenti-src.tar.gz
if errorlevel 1 goto :err
scp %SSHOPT% ops\deploy\deploy-remote.sh %HOST%:/tmp/momenti-deploy.sh
if errorlevel 1 goto :err
ssh %SSHOPT% %HOST% "bash /tmp/momenti-deploy.sh"
set RC=%errorlevel%
scp %SSHOPT% %HOST%:/tmp/momenti-deploy.log ops\deploy\deploy.log >nul 2>&1
echo.
if %RC%==0 (echo Deploy perfundoi. Shkruaj "u be" te Claude.) else (echo Deploy NUK perfundoi. Shkruaj "u be" te Claude - e lexon log-un.)
goto :eof
:err
echo Deshtoi para se te arrinte ne server. Shkruaj "u be" te Claude.
