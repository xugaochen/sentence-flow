@echo off
cd /d "%~dp0backend"
if not exist .venv (
  echo First run detected. Creating Python environment...
  py -3 -m venv .venv
  call .venv\Scripts\activate.bat
  python -m pip install -r requirements.txt
) else (
  call .venv\Scripts\activate.bat
)
echo Backend: http://127.0.0.1:8000
python -m uvicorn app.main:app --reload --host 127.0.0.1 --port 8000

