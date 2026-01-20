@echo off
setlocal
echo ==========================================
echo AI Quiz Generator - Robust Setup Script
echo ==========================================
echo.

REM Check for Python
python --version >nul 2>&1
if %errorlevel% neq 0 (
    echo [ERROR] Python is not installed or not in your PATH.
    echo Please install Python 3.11 or higher from python.org.
    pause
    exit /b 1
)

echo [INFO] Python found. Proceeding with clean setup...
echo.

REM Clean existing venv
if exist ".venv" (
    echo [ACTION] removing existing .venv directory...
    rmdir /s /q ".venv"
    if exist ".venv" (
        echo [ERROR] Failed to remove .venv. Please close any open terminals or files in .venv and try again.
        pause
        exit /b 1
    )
    echo [OK] Old environment removed.
)

REM Create new venv
echo [ACTION] Creating new virtual environment (.venv)...
python -m venv .venv
if %errorlevel% neq 0 (
    echo [ERROR] Failed to create virtual environment.
    pause
    exit /b 1
)
echo [OK] Virtual environment created.

REM Install dependencies
echo [ACTION] Installing dependencies from backend/requirements.txt...
.\.venv\Scripts\python -m pip install --upgrade pip
.\.venv\Scripts\python -m pip install -r backend\requirements.txt
if %errorlevel% neq 0 (
    echo [ERROR] Failed to install dependencies.
    pause
    exit /b 1
)
echo [OK] Dependencies installed successfully.

REM Start Project
echo.
echo [INFO] Setup complete. Starting the application...
echo ==========================================
.\.venv\Scripts\python start_project.py

endlocal
pause
