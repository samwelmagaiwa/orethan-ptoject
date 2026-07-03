@echo off
:: ============================================================
::  Orethan Biometric Agent — SIMULATION mode (no hardware)
::  Use this to test the UI without a physical scanner.
:: ============================================================

title Orethan Biometric Agent [SIMULATION]
cd /d "%~dp0"

python --version >nul 2>&1
if %errorlevel% neq 0 (
    echo [ERROR] Python not found.
    pause
    exit /b 1
)

pip show websockets >nul 2>&1
if %errorlevel% neq 0 (
    pip install -r requirements.txt
)

echo Starting in SIMULATION mode (no hardware required)...
python bio_agent.py --sim

pause
