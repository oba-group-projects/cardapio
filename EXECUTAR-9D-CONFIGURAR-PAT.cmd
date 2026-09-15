@echo off
cd /d "%~dp0"
powershell.exe -NoProfile -ExecutionPolicy Bypass -File ".scripts\8E9\EXECUTAR_9D_CONFIGURAR_PAT.ps1"
if errorlevel 1 pause
