@echo off
:: ============================================================
::  Orethan Biometric Agent — Windows Launcher
::  Double-click this file on the cashier's PC to start.
:: ============================================================

title Orethan Biometric Agent
cd /d "%~dp0"

:: Check Python
python --version >nul 2>&1
if %errorlevel% neq 0 (
    echo [ERROR] Python is not installed or not in PATH.
    echo Download Python 3.11+ from https://www.python.org/downloads/
    pause
    exit /b 1
)

:: Install / verify dependencies silently
python -c "import websockets" >nul 2>&1
if %errorlevel% neq 0 (
    echo Installing dependencies...
    pip install -r requirements.txt
)

:: Start the agent — auto-detects scanner, falls back to simulation if none found
echo.
echo Starting Orethan Biometric Agent...
echo (Connect your fingerprint scanner before or after starting — hot-plug is supported)
echo.

python bio_agent.py

pause
