@echo off
setlocal
cd /d "%~dp0"

where powershell.exe >nul 2>nul
if errorlevel 1 (
  echo No se encontro Windows PowerShell. Contacta a soporte de TI.
  pause
  exit /b 1
)

powershell.exe -NoLogo -NoProfile -ExecutionPolicy Bypass -File "%~dp0offline\servidor-local.ps1"
if errorlevel 1 pause

endlocal
