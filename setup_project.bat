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
    echo Make sure to check "Add Python to PATH" during installation.
    pause
    exit /b 1
)

echo [INFO] Python found. Proceeding with clean setup...
echo.

REM Clean existing venv
if exist ".venv" (
    echo [ACTION] Removing existing .venv directory to ensure clean slate...
    rmdir /s /q ".venv"
    if exist ".venv" (
        echo [ERROR] Failed to remove .venv. Please close any open terminals (VS Code, CMD, PowerShell) and try again.
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

REM Install dependencies with NO CACHE to avoid corruption
echo [ACTION] Installing dependencies...
echo [INFO] Using --no-cache-dir to prevent corrupted package installs.
.\.venv\Scripts\python -m pip install --upgrade pip
.\.venv\Scripts\python -m pip install --no-cache-dir -r backend\requirements.txt
if %errorlevel% neq 0 (
    echo [ERROR] Failed to install dependencies.
    pause
    exit /b 1
)
echo [OK] Dependencies installed.

REM Verify Pydantic installation (Common failure point)
echo [ACTION] Verifying core libraries...
.\.venv\Scripts\python -c "import pydantic_core; print('Pydantic Core OK')" >nul 2>&1
if %errorlevel% neq 0 (
    echo [WARNING] Pydantic Core check failed. Attempting auto-repair...
    .\.venv\Scripts\python -m pip install --force-reinstall pydantic pydantic_core
    
    REM Check again
    .\.venv\Scripts\python -c "import pydantic_core" >nul 2>&1
    if %errorlevel% neq 0 (
        echo [ERROR] Auto-repair failed. Your system might have a library conflict.
        pause
        exit /b 1
    )
    echo [OK] Auto-repair successful.
) else (
    echo [OK] Core libraries verified.
)


REM Setup Database
echo [ACTION] Applying database migrations...
.\.venv\Scripts\python backend\manage.py migrate
if %errorlevel% neq 0 (
    echo [ERROR] Failed to apply database migrations.
    pause
    exit /b 1
)

echo [ACTION] Seeding initial data...
.\.venv\Scripts\python backend\manage.py seed_categories
if %errorlevel% neq 0 (
    echo [WARNING] Failed to seed categories. usage might be affected.
)

REM Start Project
echo.
echo [INFO] Setup complete. Starting the application...
echo ==========================================
.\.venv\Scripts\python start_project.py

endlocal
pause
