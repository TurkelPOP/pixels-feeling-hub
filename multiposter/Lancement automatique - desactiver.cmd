@echo off
chcp 65001 >nul
powershell -NoProfile -Command "Remove-Item -ErrorAction SilentlyContinue ([Environment]::GetFolderPath('Startup') + '\Multiposter.lnk')"
echo Lancement automatique desactive. (L'app en cours continue de tourner : utilise "Arreter Multiposter" pour l'arreter.)
pause
