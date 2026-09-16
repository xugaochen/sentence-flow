@echo off
cd /d "%~dp0"
start "Language Study API (Development)" cmd /k call "%~dp0start-backend.bat"
start "Language Study Web (Development)" cmd /k call "%~dp0start-frontend.bat"
echo Starting development mode in two windows...
echo Web: http://localhost:5173
echo API docs: http://127.0.0.1:8000/docs
echo Code changes will reload automatically.
pause
