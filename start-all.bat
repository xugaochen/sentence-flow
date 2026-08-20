@echo off
cd /d "%~dp0"
start "Language Study API" cmd /k call "%~dp0start-backend.bat"
start "Language Study Web" cmd /k call "%~dp0start-frontend.bat"
echo Starting backend and frontend in two windows...
echo Open http://localhost:5173 after both are ready.
pause

