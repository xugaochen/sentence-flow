@echo off
cd /d "%~dp0backend"
if not exist .venv (
  echo Please run start-backend.bat once before adding example data.
  pause
  exit /b 1
)
call .venv\Scripts\activate.bat
python seed.py
pause

