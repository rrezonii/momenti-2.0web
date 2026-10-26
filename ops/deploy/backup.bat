@echo off
setlocal EnableDelayedExpansion
cd /d "%~dp0..\.."
set KEY=C:\Users\Admin\.ssh\codex_vps
set HOST=root@62.171.174.17
set SSHOPT=-i "%KEY%" -o StrictHostKeyChecking=accept-new -o BatchMode=yes -o ServerAliveInterval=30
set DEST=C:\Users\Admin\Desktop\momenti-backups
if not exist "%DEST%" mkdir "%DEST%"
echo == 1/4 Krijoj backup-in ne server (site, KFL, WordPress)...
scp %SSHOPT% ops\deploy\backup-remote.sh %HOST%:/tmp/momenti-backup.sh
if errorlevel 1 goto :err
ssh %SSHOPT% %HOST% "bash /tmp/momenti-backup.sh"
if errorlevel 1 goto :err
scp %SSHOPT% %HOST%:/tmp/momenti-backup-files.txt ops\deploy\backup-files.txt
if errorlevel 1 goto :err
scp %SSHOPT% %HOST%:/tmp/momenti-backup.log ops\deploy\backup.log >nul 2>&1
echo == 2/4 Shkarkoj ne %DEST% ...
set MAIN=
for /f "usebackq delims=" %%F in ("ops\deploy\backup-files.txt") do (
  if not defined MAIN set MAIN=%%~nxF
  echo    %%~nxF
  scp %SSHOPT% %HOST%:%%F "%DEST%"
  if errorlevel 1 goto :err
)
echo == 3/4 Kontrolloj skedaret e shkarkuar...
if exist ops\deploy\backup-local-hash.txt del ops\deploy\backup-local-hash.txt
for /f "usebackq delims=" %%F in ("ops\deploy\backup-files.txt") do certutil -hashfile "%DEST%\%%~nxF" SHA256 >> ops\deploy\backup-local-hash.txt
echo == 4/4 Nxjerr draftet e KFL ne folder te hapur...
if exist "%DEST%\kfl-drafts-tmp" rmdir /s /q "%DEST%\kfl-drafts-tmp"
mkdir "%DEST%\kfl-drafts-tmp"
tar -xzf "%DEST%\!MAIN!" -C "%DEST%\kfl-drafts-tmp" var/www/momenti/data/kfl-drafts
if errorlevel 1 (
  echo    Draftet nuk u nxorren - arkiva mbetet e plote te %DEST%
) else (
  if exist "%DEST%\kfl-drafts" rmdir /s /q "%DEST%\kfl-drafts"
  move "%DEST%\kfl-drafts-tmp\var\www\momenti\data\kfl-drafts" "%DEST%\kfl-drafts" >nul
  for /f %%N in ('dir /ad /b "%DEST%\kfl-drafts" ^| find /c /v ""') do echo    %%N drafte te ruajtura te %DEST%\kfl-drafts
)
if exist "%DEST%\kfl-drafts-tmp" rmdir /s /q "%DEST%\kfl-drafts-tmp"
echo.
echo Backup-i u ruajt te: %DEST%
echo Shkruaj "u be" te Claude.
goto :eof
:err
echo Backup-i deshtoi. Shkruaj "u be" te Claude.
