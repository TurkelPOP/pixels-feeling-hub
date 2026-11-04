@echo off
chcp 65001 >nul
powershell -NoProfile -Command "$p = Get-CimInstance Win32_Process -Filter \"Name='node.exe'\" | Where-Object { $_.CommandLine -like '*src\server.ts*' }; if ($p) { $p | ForEach-Object { Stop-Process -Id $_.ProcessId -Force }; Write-Host 'Multiposter est arrete.' } else { Write-Host 'Multiposter ne tournait pas.' }"
timeout /t 4 >nul
