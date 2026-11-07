@echo off
chcp 65001 >nul
cd /d "%~dp0"
title Mise a jour de PTZ Posting
where node >nul 2>nul
if errorlevel 1 (
  echo Node.js n'est pas installe. Installe la version LTS depuis https://nodejs.org
  pause
  exit /b 1
)
echo Arret de PTZ Posting s'il tourne...
powershell -NoProfile -Command "Get-CimInstance Win32_Process -Filter \"Name='node.exe'\" | Where-Object { $_.CommandLine -like '*src\server.ts*' } | ForEach-Object { Stop-Process -Id $_.ProcessId -Force }"
rem La ligne suivante se termine par exit : ce fichier peut ainsi etre remplace pendant la mise a jour.
node --disable-warning=ExperimentalWarning scripts\update.ts --offer-restart & pause & exit /b
