#!/usr/bin/env bash
set -euo pipefail

project_dir="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
conda_bin="${CONDA_EXE:-}"
app_port="${LANGUAGE_STUDY_FRONTEND_PORT:-5173}"

if [[ -z "$conda_bin" || ! -x "$conda_bin" ]]; then
  conda_bin="$(command -v conda || true)"
fi

if [[ -z "$conda_bin" ]]; then
  echo "未找到 conda。请先安装或初始化 Miniconda。" >&2
  exit 1
fi

if ! env_prefix="$("$conda_bin" run -n language-study python -c 'import sys; print(sys.prefix)')"; then
  echo "未找到 language-study 环境。请先按照 README 的 Linux 安装步骤创建环境。" >&2
  exit 1
fi

python_bin="$env_prefix/bin/python"
node_bin="$env_prefix/bin/node"
npm_bin="$env_prefix/bin/npm"

if [[ ! -x "$python_bin" ]]; then
  echo "language-study 环境中没有可用的 Python。" >&2
  exit 1
fi

if [[ ! -x "$node_bin" || ! -x "$npm_bin" ]]; then
  echo "language-study 环境中没有 Node.js。请运行：" >&2
  echo "conda install -n language-study -c conda-forge nodejs=22" >&2
  exit 1
fi

if [[ ! -d "$project_dir/frontend/node_modules" ]]; then
  echo "首次运行：正在安装前端依赖……"
  (
    cd "$project_dir/frontend"
    PATH="$env_prefix/bin:$PATH" "$npm_bin" install
  )
fi

echo "正在构建前端……"
(
  cd "$project_dir/frontend"
  PATH="$env_prefix/bin:$PATH" "$npm_bin" run build
)

echo
echo "句流低负载模式正在启动："
echo "  网页       http://localhost:$app_port"
echo "  API 文档   http://127.0.0.1:$app_port/docs"
echo
echo "按 Ctrl+C 可停止服务。开发代码时请使用 ./start-dev-linux.sh。"
echo

cd "$project_dir/backend"
exec "$python_bin" -m uvicorn app.main:app --host 127.0.0.1 --port "$app_port"
