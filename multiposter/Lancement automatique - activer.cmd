@echo off
chcp 65001 >nul
cd /d "%~dp0"
if not exist .env (
  echo Lance d'abord "Demarrer Multiposter" une fois pour choisir ton mot de passe.
  pause
  exit /b 1
)
powershell -NoProfile -Command "$s = (New-Object -ComObject WScript.Shell).CreateShortcut([Environment]::GetFolderPath('Startup') + '\Multiposter.lnk'); $s.TargetPath = 'wscript.exe'; $s.Arguments = '\"%~dp0scripts\multiposter-cache.vbs\"'; $s.WorkingDirectory = '%~dp0'; $s.Save()"
if errorlevel 1 (
  echo Impossible de creer le lancement automatique.
  pause
  exit /b 1
)
echo Lancement automatique active : Multiposter demarrera en arriere-plan a chaque ouverture de session Windows.
echo Pour ouvrir l'app : double-clique sur "Demarrer Multiposter" ou va sur http://127.0.0.1:3210
echo.
choice /m "Le demarrer en arriere-plan tout de suite"
if errorlevel 2 exit /b 0
wscript.exe "%~dp0scripts\multiposter-cache.vbs"
echo Multiposter demarre en arriere-plan.
timeout /t 4 >nul
