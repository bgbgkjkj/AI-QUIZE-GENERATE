@echo off
echo Starting backend server...
cd backend
call .venv\Scripts\activate.bat
python manage.py runserver
