@echo off
cd /d "%~dp0..\.."
set KEY=C:\Users\Admin\.ssh\codex_vps
set HOST=root@62.171.174.17
scp -i "%KEY%" -o StrictHostKeyChecking=accept-new -o BatchMode=yes ops\deploy\discover.sh %HOST%:/tmp/momenti-discover.sh > ops\deploy\discover.log 2>&1
ssh -i "%KEY%" -o StrictHostKeyChecking=accept-new -o BatchMode=yes %HOST% "bash /tmp/momenti-discover.sh" >> ops\deploy\discover.log 2>&1
echo Gati. >> ops\deploy\discover.log
