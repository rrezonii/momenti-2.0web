@echo off
setlocal
cd /d "%~dp0..\.."
rem Creates a separate SSH key only for GitHub's automatic deploy, adds it to the VPS,
rem and opens the two values to paste into GitHub secrets. Your own key is not shared.
set KEY=C:\Users\Admin\.ssh\codex_vps
set HOST=root@62.171.174.17
set SSHOPT=-i "%KEY%" -o StrictHostKeyChecking=accept-new -o BatchMode=yes
if exist ops\github\deploy_key del /q ops\github\deploy_key
if exist ops\github\deploy_key.pub del /q ops\github\deploy_key.pub
echo == 1/3 Krijoj celesin e ri (vetem per deploy)
ssh-keygen -q -t ed25519 -N "" -C "github-actions-deploy@momenti" -f ops\github\deploy_key
if errorlevel 1 goto :err
echo == 2/3 E shtoj ne server
type ops\github\deploy_key.pub | ssh %SSHOPT% %HOST% "mkdir -p ~/.ssh && chmod 700 ~/.ssh && cat >> ~/.ssh/authorized_keys && chmod 600 ~/.ssh/authorized_keys"
if errorlevel 1 goto :err
echo == 3/3 Marr gjurmen e serverit (known_hosts)
ssh-keyscan -t ed25519 62.171.174.17 > ops\github\known_hosts.txt 2>nul
echo.
echo GATI. Do te hapen 2 skedare ne Notepad:
echo   deploy_key       -^> ngjite te GitHub secret  VPS_SSH_KEY
echo   known_hosts.txt  -^> ngjite te GitHub secret  VPS_KNOWN_HOSTS
echo Pasi t'i ngjitesh, fshiji te dy skedaret (ose shkruaj te Claude dhe te tregon si).
notepad ops\github\deploy_key
notepad ops\github\known_hosts.txt
goto :end
:err
echo XXX Diçka deshtoi. Shkruaj "u be" te Claude.
:end
endlocal
