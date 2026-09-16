#!/usr/bin/env bash
set -euo pipefail

project_dir="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
conda_bin="${CONDA_EXE:-}"
backend_port="${LANGUAGE_STUDY_BACKEND_PORT:-8000}"
frontend_port="${LANGUAGE_STUDY_FRONTEND_PORT:-5173}"

if [[ -z "$conda_bin" || ! -x "$conda_bin" ]]; then
  conda_bin="$(command -v conda || true)"
fi

if [[ -z "$conda_bin" ]]; then
  echo "未找到 conda。请先安装或初始化 Miniconda。" >&2
  exit 1
fi

if ! "$conda_bin" run -n language-study python --version >/dev/null 2>&1; then
  echo "未找到 language-study 环境。请先按照 README 的 Linux 安装步骤创建环境。" >&2
  exit 1
fi

if ! "$conda_bin" run -n language-study node --version >/dev/null 2>&1; then
  echo "language-study 环境中没有 Node.js。请运行：" >&2
  echo "conda install -n language-study -c conda-forge nodejs=22" >&2
  exit 1
fi

if [[ ! -d "$project_dir/frontend/node_modules" ]]; then
  echo "首次运行：正在安装前端依赖……"
  (
    cd "$project_dir/frontend"
    "$conda_bin" run --no-capture-output -n language-study npm install
  )
fi

backend_pid=""
frontend_pid=""

stop_services() {
  echo
  echo "正在停止句流开发服务……"
  [[ -n "$backend_pid" ]] && kill "$backend_pid" 2>/dev/null || true
  [[ -n "$frontend_pid" ]] && kill "$frontend_pid" 2>/dev/null || true
  [[ -n "$backend_pid" ]] && wait "$backend_pid" 2>/dev/null || true
  [[ -n "$frontend_pid" ]] && wait "$frontend_pid" 2>/dev/null || true
}

handle_signal() {
  trap - EXIT INT TERM
  stop_services
  exit 0
}

trap stop_services EXIT
trap handle_signal INT TERM

(
  cd "$project_dir/backend"
  exec "$conda_bin" run --no-capture-output -n language-study \
    python -m uvicorn app.main:app --reload --host 127.0.0.1 --port "$backend_port"
) &
backend_pid=$!

(
  cd "$project_dir/frontend"
  export LANGUAGE_STUDY_BACKEND_URL="http://127.0.0.1:$backend_port"
  exec "$conda_bin" run --no-capture-output -n language-study \
    npm run dev -- --host 127.0.0.1 --port "$frontend_port"
) &
frontend_pid=$!

echo
echo "句流开发模式正在启动："
echo "  网页       http://localhost:$frontend_port"
echo "  API 文档   http://127.0.0.1:$backend_port/docs"
echo
echo "代码修改会自动重载。按 Ctrl+C 可同时停止前端和后端。"
echo

set +e
wait -n "$backend_pid" "$frontend_pid"
exit_code=$?
set -e

if [[ $exit_code -ne 0 ]]; then
  echo "有一个开发服务异常退出，请查看上方日志。" >&2
fi
exit "$exit_code"
