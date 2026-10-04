@echo off
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0scripts\local-valuation\control.ps1" status
pause
