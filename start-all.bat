@echo off
setlocal
cd /d "%~dp0"

if not exist "backend\.venv\Scripts\python.exe" (
  echo First run detected. Creating Python environment...
  py -3 -m venv "backend\.venv"
  if errorlevel 1 goto :error
  call "backend\.venv\Scripts\activate.bat"
  python -m pip install -r "backend\requirements.txt"
  if errorlevel 1 goto :error
) else (
  call "backend\.venv\Scripts\activate.bat"
)

where node >nul 2>nul
if errorlevel 1 (
  echo Node.js was not found. Install Node.js 22.12 or newer and try again.
  goto :error
)

if not exist "frontend\node_modules" (
  echo First run detected. Installing frontend dependencies...
  pushd "frontend"
  call npm install
  if errorlevel 1 (
    popd
    goto :error
  )
  popd
)

echo Building frontend...
pushd "frontend"
call npm run build
if errorlevel 1 (
  popd
  goto :error
)
popd

set "APP_PORT=5173"
if defined LANGUAGE_STUDY_FRONTEND_PORT set "APP_PORT=%LANGUAGE_STUDY_FRONTEND_PORT%"

echo.
echo Sentence Flow is starting in low-resource mode:
echo   Web       http://localhost:%APP_PORT%
echo   API docs  http://127.0.0.1:%APP_PORT%/docs
echo.
echo Press Ctrl+C to stop. Use start-dev.bat when developing code.
echo.

cd /d "%~dp0backend"
python -m uvicorn app.main:app --host 127.0.0.1 --port %APP_PORT%
exit /b %errorlevel%

:error
echo.
echo Startup failed. Review the message above.
pause
exit /b 1
