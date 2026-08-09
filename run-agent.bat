@echo off
title WhatsApp AI Sales Agent Launcher
color 0A
cls

echo ======================================================================
echo  🤖 WhatsApp AI Sales Agent & OpenWA Gateway Local Launcher
echo ======================================================================
echo.

:: 1. Check Node.js — Auto Install if missing
where node >nul 2>nul
if %errorlevel% neq 0 (
    echo [!] Node.js is not installed on this PC.
    echo [!] Automatically downloading & installing Node.js LTS for you...
    echo.
    powershell -Command "start-process winget -ArgumentList 'install --id OpenJS.NodeJS.LTS --silent --accept-package-agreements --accept-source-agreements' -Wait" 2>nul
    where node >nul 2>nul
    if %errorlevel% neq 0 (
        echo [!] Winget fallback: Downloading official Node.js installer from nodejs.org...
        powershell -Command "$msi = '$env:TEMP\node-setup.msi'; Invoke-WebRequest -Uri 'https://nodejs.org/dist/v22.11.0/node-v22.11.0-x64.msi' -OutFile $msi; Start-Process msiexec.exe -ArgumentList '/i', $msi, '/qb' -Wait; Remove-Item $msi"
    )
    echo [✓] Node.js installed successfully!
    set "PATH=%ProgramFiles%\nodejs;%APPDATA%\npm;%PATH%"
)

:: 2. Check and Install Dependencies
if not exist node_modules (
    echo [!] Installing dependencies for the first run (this may take 1-2 minutes)...
    call npm install
)

if not exist openwa\node_modules (
    echo [!] Installing OpenWA Gateway dependencies...
    cd openwa
    call npm install
    cd ..
)

:: 3. Generate Prisma DB Client
echo [✓] Synchronizing local SQLite database schema...
call npx prisma generate >nul 2>nul
call npx prisma db push --skip-generate >nul 2>nul

:: 4. Launch OpenWA Gateway & Next.js Platform
echo [🚀] Starting OpenWA Gateway & WhatsApp AI Sales Agent...
echo.

start "WhatsApp AI Sales Agent" /b npm run dev

:: 5. Open Default Web Browser after 4 seconds
timeout /t 4 /nobreak >nul
start http://localhost:3000

echo ======================================================================
echo  ✅ WhatsApp AI Agent is running locally on your laptop!
echo ======================================================================
echo  • Web Dashboard:     http://localhost:3000
echo  • OpenWA Gateway:    http://localhost:2785
echo ======================================================================
echo.
echo NOTE: Keep this command window open while using the agent.
echo To stop the agent completely, double-click "stop-agent.bat" or close this window.
echo.
pause
