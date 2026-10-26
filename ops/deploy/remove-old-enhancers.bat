@echo off
cd /d "%~dp0..\.."
set KEY=C:\Users\Admin\.ssh\codex_vps
set HOST=root@62.171.174.17
set SSHOPT=-i "%KEY%" -o StrictHostKeyChecking=accept-new -o BatchMode=yes -o ServerAliveInterval=30
echo == 1/3 Fshij enhancer-at e vjeter ne kete PC
for %%D in ("app\(sq)\kycu\api\enhance" "app\(sq)\kycu\api\enhance-ai" "app\(sq)\kycu\api\enhance-chatgpt" "scripts\kfl-enhancer" ".kfl-esrgan-venv" ".kfl-enhancer-venv" ".kfl-tmp") do (
  if exist %%D ( rmdir /s /q %%D && echo    u fshi: %%~D )
)
if exist .env.local (
  findstr /v /b /c:"OPENAI_API_KEY=" /c:"KFL_ENHANCER_" .env.local > .env.local.new
  move /y .env.local.new .env.local >nul
  echo    OPENAI_API_KEY u hoq nga .env.local
)
echo == 2/3 Pastroj serverin
scp %SSHOPT% ops\deploy\cleanup-enhancers-remote.sh %HOST%:/tmp/momenti-cleanup.sh
if errorlevel 1 goto :err
ssh %SSHOPT% %HOST% "bash /tmp/momenti-cleanup.sh"
scp %SSHOPT% %HOST%:/tmp/momenti-cleanup.log ops\deploy\cleanup.log >nul 2>&1
echo == 3/3 Deploy i editorit te ri
call ops\deploy\deploy.bat
goto :eof
:err
echo Deshtoi lidhja me serverin. Shkruaj "u be" te Claude.
