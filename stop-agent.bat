@echo off
title Stop WhatsApp AI Sales Agent
color 0C
cls

echo ======================================================================
echo  🛑 Stopping WhatsApp AI Sales Agent & OpenWA Gateway...
echo ======================================================================
echo.

taskkill /F /IM node.exe >nul 2>nul

echo [✓] All WhatsApp Agent processes stopped cleanly!
echo.
pause
