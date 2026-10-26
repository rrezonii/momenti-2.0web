@echo off
setlocal
cd /d "%~dp0..\.."
echo === Dergoj kodin e Momenti ne GitHub (rrezonii/momenti-2.0web) ===
where git >nul 2>nul || (echo Git nuk eshte i instaluar. Shkarko nga https://git-scm.com dhe provo perseri. & goto :end)

git add -A
echo.
echo === Kontroll sigurie: a ka celesa/fjalekalime ne skedaret qe do dergohen? ===
git grep --cached -nIE "sk-[A-Za-z0-9_-]{20,}|pk_live_|BEGIN (RSA |OPENSSH |EC )?PRIVATE KEY|(PRUNA_API_KEY|OPENAI_API_KEY|WORDPRESS_APP_PASSWORD)=[A-Za-z0-9_.-]{12,}" -- . ":(exclude)ops/github/push-first.bat" > "%TEMP%\momenti-secrets.txt"
for %%A in ("%TEMP%\momenti-secrets.txt") do if %%~zA GTR 0 (
  echo XXX U gjet dicka qe duket si celes ose fjalekalim. NUK dergohet asgje:
  type "%TEMP%\momenti-secrets.txt"
  git reset -q
  goto :end
)
echo    Ne rregull - asnje celes ose fjalekalim.

git -c user.name="Momenti" -c user.email="momentimedia.ou@gmail.com" commit -q -m "Momenti website: kodi aktual" || echo (asgje e re per commit)
git branch -M main
git remote remove origin >nul 2>nul
git remote add origin https://github.com/rrezonii/momenti-2.0web.git
echo.
echo === Dergimi (nese hapet dritarja e GitHub, hyr me llogarine tende) ===
git push -u origin main --force
if errorlevel 1 (echo XXX Dergimi deshtoi. Shkruaj "u be" te Claude. & goto :end)
echo.
echo === GATI: kodi eshte ne GitHub (private). ===
:end
echo Shkruaj "u be" te Claude.
endlocal
