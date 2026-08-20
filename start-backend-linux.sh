#!/usr/bin/env bash
set -euo pipefail

project_dir="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
conda_bin="$(command -v conda || true)"

if [[ -z "$conda_bin" ]]; then
  echo "未找到 conda。请先安装 Miniconda，或把 conda 加入 PATH。" >&2
  exit 1
fi

cd "$project_dir/backend"
exec "$conda_bin" run --no-capture-output -n language-study \
  python -m uvicorn app.main:app --reload --host 127.0.0.1 --port 8000

