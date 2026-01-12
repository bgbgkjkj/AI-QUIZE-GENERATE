@echo off
call backend\venv\Scripts\activate.bat
python backend/manage.py runserver
