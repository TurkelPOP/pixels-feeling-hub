@echo off
chcp 65001 >nul
cd /d "%~dp0"
title PTZ Posting

where node >nul 2>nul
if errorlevel 1 (
  echo Node.js n'est pas installe.
  echo Installe la version LTS depuis https://nodejs.org puis relance ce fichier.
  pause
  exit /b 1
)

rem Deja lance (par exemple au demarrage de Windows) : on ouvre juste le navigateur.
curl.exe -s -o nul http://127.0.0.1:3210/login
if not errorlevel 1 (
  echo PTZ Posting tourne deja. Ouverture dans le navigateur...
  start "" http://127.0.0.1:3210/open
  timeout /t 3 >nul
  exit /b 0
)

if not exist node_modules (
  echo Installation de l'app, une seule fois...
  call npm.cmd install --omit=dev --no-audit --no-fund
  if errorlevel 1 (
    echo L'installation a echoue. Envoie une capture de cette fenetre.
    pause
    exit /b 1
  )
)

if not exist .env (
  node --disable-warning=ExperimentalWarning scripts\setup.ts
  if errorlevel 1 (
    pause
    exit /b 1
  )
)

set OPEN_BROWSER=1
echo.
echo PTZ Posting demarre. Garde cette fenetre ouverte : la fermer arrete l'app.
echo.
node --disable-warning=ExperimentalWarning src\server.ts
echo.
echo PTZ Posting s'est arrete.
pause
