# 句流 · 个人语言学习工具

一个以“主动输出”为核心的外语学习本地 Web 应用，目前支持日语、西班牙语和英语。你看到中文提示后，必须先完整输入目标语言；提交后才会看到标准答案，再由自己评价“不会 / 模糊 / 会了”。

句子始终是核心。单词只能由你从句子详情中手动挑选，并通过多对多关系保留一个或多个来源句。

## 已实现功能

- 句子的添加、查看、编辑、移至回收站、搜索及语言 / 标签 / 熟练度筛选
- 句子主动输入复习；忽略首尾空白并统一 Unicode NFC，提交后用红色和绿色标出字符差异
- “不会 / 模糊 / 会了”自评，并可选择智能间隔、5 / 3 / 1 加权、均匀有放回或新题优先抽题
- 从句子详情或句子复习揭晓页手动添加单词，不做自动分词
- 句子和单词均可记录自己的注释、语法说明与使用提示
- 句子复习揭晓答案后可直接补充句子注释，并新建或关联词库中的单词
- 可在同一句中连续添加多个单词；“保存并继续添加”无需反复开关表单
- 添加已存在的同语言、同词形单词时，只建立新的来源关联，不覆盖原单词资料
- 单词与来源句的多对多关联
- 单词库的编辑、移至回收站、搜索及语言 / 词性 / 标签 / 熟练度筛选
- 单词主动输入复习，提交后显示全部来源句及中文语境
- 句子详情、单词详情和复习答案支持免费的浏览器系统语音朗读
- 数据管理页可恢复误删内容、永久删除或清空回收站，并导出完整 JSON / CSV ZIP
- 首页句子数、语言分布、单词数、今日复习次数统计
- 无账号和运行时云端依赖；应用读取本机 SQLite 文件，数据可通过 Private GitHub 仓库手动同步

## 技术栈

- 前端：React 19、React Router、Vite
- 后端：Python、FastAPI、SQLAlchemy
- 数据库：SQLite

## 项目目录

```text
language_study/
├─ backend/
│  ├─ app/
│  │  ├─ routers/
│  │  │  ├─ data.py          # 回收站和数据导出 API
│  │  │  ├─ meta.py          # 统计、标签和词性 API
│  │  │  ├─ reviews.py       # 加权抽题和复习记录 API
│  │  │  ├─ sentences.py     # 句子 API
│  │  │  └─ words.py         # 单词 API
│  │  ├─ database.py         # SQLite 连接
│  │  ├─ main.py             # FastAPI 入口
│  │  ├─ migrations.py       # 保留旧数据的增量迁移
│  │  ├─ models.py           # 数据表及多对多关系
│  │  ├─ schemas.py          # 请求 / 响应数据结构
│  │  └─ services.py         # 标签与加权抽样逻辑
│  ├─ tests/test_api.py       # 核心 API 测试
│  ├─ language_study.db       # 个人学习数据（仅随 Private 仓库同步）
│  ├─ requirements.txt
│  ├─ requirements-dev.txt
│  └─ seed.py                # 可重复运行的示例数据脚本
├─ frontend/
│  ├─ src/
│  │  ├─ components/         # 导航、差异、朗读、标签和状态组件
│  │  ├─ pages/              # 首页、详情、库、表单、复习和数据管理页
│  │  ├─ utils/              # 答案标准化和字符差异算法
│  │  ├─ api.js
│  │  ├─ constants.js
│  │  ├─ main.jsx
│  │  └─ styles.css
│  ├─ index.html
│  ├─ package.json
│  └─ vite.config.js
├─ seed-example-data.bat
├─ start-all-linux.sh       # Linux/WSL 低负载启动（默认）
├─ start-dev-linux.sh       # Linux/WSL 开发模式
├─ start-backend-linux.sh   # Linux/WSL 独立后端开发服务
├─ start-all.bat            # Windows 低负载启动（默认）
├─ start-dev.bat            # Windows 开发模式
├─ start-backend.bat        # Windows 独立后端开发服务
└─ start-frontend.bat       # Windows 独立前端开发服务
```

## 运行模式

| 模式 | 适合场景 | 运行方式 | 地址 |
| --- | --- | --- | --- |
| 低负载模式（默认） | 日常学习 | 启动时快速构建前端，运行期间只保留一个不带热重载的 Python 服务 | `http://localhost:5173` |
| 开发模式 | 修改和调试代码 | 同时运行 Vite 与 Uvicorn，支持前端热更新和后端自动重载 | 网页 `5173`，API `8000` |

默认模式每次启动都会执行一次前端生产构建。Node.js 只在这段短暂的构建期间工作，构建完成后由 FastAPI 同时提供网页与 `/api`，不会保留 Vite 开发服务器。修改代码后需要重启默认模式才能看到变化。

## Windows 快速启动

### 准备环境

1. 安装 [Python 3.11 或更高版本](https://www.python.org/downloads/)，安装时勾选 `Add Python to PATH`。
2. 安装 [Node.js 22.12 或更高版本](https://nodejs.org/)（也支持 20.19 及以上版本）。
3. 下载或复制整个项目目录，不要只复制其中一个子目录。

### 一键启动

日常学习时双击根目录的 `start-all.bat`。第一次运行会自动：

1. 在 `backend\.venv` 建立 Python 虚拟环境并安装后端依赖；
2. 在 `frontend\node_modules` 安装前端依赖；
3. 构建前端，并在当前窗口启动一个低负载服务。

当前窗口显示服务已启动后，在浏览器访问：

```text
http://localhost:5173
```

API 文档位于 `http://127.0.0.1:5173/docs`。在启动窗口按 `Ctrl+C` 或关闭窗口即可停止应用。

开发代码时双击 `start-dev.bat`。它会打开前端和后端两个窗口，网页仍位于 `http://localhost:5173`，API 文档位于 `http://127.0.0.1:8000/docs`；关闭两个窗口即可完全停止开发服务。

## Linux + Conda 启动

推荐创建独立环境，不要把依赖安装到 `base`：

```bash
conda create -n language-study python=3.12 pip -y
conda install -n language-study -c conda-forge nodejs=22 -y
conda activate language-study
cd /path/to/language_study
python -m pip install -r backend/requirements.txt
```

环境准备好后，日常学习推荐使用低负载一键脚本：

```bash
cd /path/to/language_study
./start-all-linux.sh
```

脚本会先快速构建前端，然后只运行一个 Python 服务。浏览器访问 `http://localhost:5173`，API 文档位于 `http://127.0.0.1:5173/docs`；终端按 `Ctrl+C` 即可停止。

修改代码时使用开发模式：

```bash
./start-dev-linux.sh
```

开发模式会同时运行 Vite 和带热重载的 Uvicorn。网页位于 `http://localhost:5173`，API 文档位于 `http://127.0.0.1:8000/docs`。开发模式占用的内存明显更高，这是文件监听和自动重载所需的正常开销。

如果只想运行后端，可以使用：

```bash
./start-backend-linux.sh
```

也可以手动启动：

```bash
conda activate language-study
cd /path/to/language_study/backend
python -m uvicorn app.main:app --reload --host 127.0.0.1 --port 8000
```

不使用一键脚本时，前端需要在另一个终端运行：

```bash
cd /path/to/language_study/frontend
npm install
npm run dev
```

## 手动启动开发服务

在 PowerShell 或 Windows Terminal 中执行：

```powershell
cd path\to\language_study\backend
py -3 -m venv .venv
.\.venv\Scripts\Activate.ps1
python -m pip install -r requirements.txt
python -m uvicorn app.main:app --reload --host 127.0.0.1 --port 8000
```

另开一个终端：

```powershell
cd path\to\language_study\frontend
npm install
npm run dev
```

然后访问 `http://localhost:5173`。后端 API 文档位于 `http://127.0.0.1:8000/docs`。这种手动双服务方式等同于开发模式，不是日常学习所需的低负载模式。

## SQLite 初始化与示例数据

后端会使用仓库中的 `backend\language_study.db`。如果该文件不存在，第一次启动时会自动创建数据库和数据表，不需要手动执行 SQL。

如果想加入示例句子和关联单词，可在后端环境安装完成后双击：

```text
seed-example-data.bat
```

脚本可以重复运行，不会重复写入相同示例。示例数据不是应用运行的必要条件。

### 清空全部学习数据

先关闭后端，然后备份并删除 `backend\language_study.db`。再次启动后端时会得到一个空数据库。此操作不可撤销，请先复制该文件作为备份。

## 开发测试

```powershell
cd backend
.\.venv\Scripts\Activate.ps1
python -m pip install -r requirements-dev.txt
python -m pytest -q
```

前端生产构建检查：

```powershell
cd frontend
npm run build
```

## 数据和规则说明

- 数据库语言代码为 `ja`、`es` 和 `en`，界面显示“日语”“西班牙语”和“英语”。
- 熟练度保存为 `unknown`、`fuzzy`、`known`，界面显示“不会”“模糊”“会了”。
- 复习提供四种抽题方式：默认的智能间隔综合熟练度、距上次复习时间和累计次数；加权随机使用 5 / 3 / 1 权重；均匀有放回允许本轮重复但避免连续重复；新题优先会先完成复习次数为 0 的内容。除均匀有放回外，一轮内不重复。
- 答案比较先使用 `trim` 忽略首尾空白，再统一为 Unicode NFC；标点、内部空格及其他字符仍必须一致。答错时，用户多写或写错的内容显示为红色，标准答案中缺失或不同的内容显示为绿色。
- 自评后才会更新熟练度、复习次数、最近复习时间和今日复习统计。
- 单词判重使用“语言 + 去除首尾空格并忽略大小写后的词形”。
- 删除操作只会把内容移至回收站，并保留句词关联。恢复后关联自动回来；只有永久删除才会清理该内容的关联和复习记录，不会删除另一类学习内容。
- 普通列表、详情、搜索、统计、标签和复习不会出现回收站内容。回收站不会自动过期。
- 数据管理页的 JSON 包含版本、导出时间、句子、单词、标签、句词与标签关系、复习记录及 `deleted_at` 回收站状态；CSV ZIP 提供对应的独立表格和清单。
- 导出只包含学习数据，不包含环境变量、API 密钥、运行环境或本机配置。
- 应用启动时会自动执行仅新增字段的 SQLite 迁移；升级会添加回收站字段，不会清空已有内容、关系或复习记录。

## 浏览器朗读

朗读使用浏览器的 Web Speech API，不调用在线服务，也不需要 API Key。日语请求 `ja-JP`、西班牙语请求 `es-ES`、英语请求 `en-US` 语音；可以分别选择系统音色和语速，质量取决于操作系统安装的语音包。

如果按钮显示为禁用，请在系统语言或辅助功能设置中安装对应语言的语音，然后完全重启浏览器。应用不会自动朗读，每次开始朗读前会停止上一次语音。

## 回收站与导出

顶部导航进入“数据管理”后，可以恢复单条内容、永久删除单条内容或清空回收站。永久删除和清空操作无法撤销，执行前仍建议单独备份数据库。

“下载完整 JSON”适合程序化备份和检查关系；“下载 CSV 压缩包”适合用 Excel 或其他表格软件查看。当前版本只提供导出，不提供导入。

## 常见问题

### `py` 或 `python` 不是内部或外部命令

重新安装 Python 并勾选加入 PATH。也可以在 `start-backend.bat` 中把 `py -3` 改为你机器可用的 `python` 命令。

### `npm` 不是内部或外部命令

安装 Node.js LTS 后关闭并重新打开终端，再运行 `node --version` 与 `npm --version` 确认。

### PowerShell 禁止运行脚本

直接使用 `.bat` 启动；或仅为当前终端执行：

```powershell
Set-ExecutionPolicy -Scope Process Bypass
```

### 页面提示“请求失败，请确认后端已启动”

默认低负载模式下，确认启动窗口没有报错，并打开 `http://127.0.0.1:5173/api/health`；开发模式下打开 `http://127.0.0.1:8000/api/health`。正常结果应为 `{"status":"ok"}`。开发模式如果修改后端端口，还需要通过 `LANGUAGE_STUDY_BACKEND_URL` 告诉 Vite 新地址。

### 端口 5173 已被占用

先关闭之前启动但尚未退出的句流或其他占用 5173 的程序。Linux/WSL 也可以临时指定其他端口：

```bash
LANGUAGE_STUDY_FRONTEND_PORT=5174 ./start-all-linux.sh
```

Windows 可先执行 `set LANGUAGE_STUDY_FRONTEND_PORT=5174`，再运行 `start-all.bat`。低负载模式的网页、API 和 `/docs` 会共同改到新端口。开发模式需要确保前端和后端使用不同端口。

### 修改代码后页面没有变化

低负载模式不会监听源码变化。按 `Ctrl+C` 停止后重新运行默认启动脚本，脚本会重新构建前端；频繁开发时请改用 `start-dev-linux.sh` 或 `start-dev.bat`。

### 中文或日文显示异常

项目文件均为 UTF-8。请不要用会转换为 ANSI 编码的旧版编辑器保存文件；现代 VS Code、Windows Terminal 和浏览器均可正常显示。

### 想备份或迁移数据

数据库已经纳入 Private GitHub 仓库。提交学习数据前必须先关闭应用，避免在 SQLite 写入过程中复制或提交文件：

```bash
git add -- backend/language_study.db
git commit -m "Update study data"
git push origin main
```

新机器使用前先执行 `git pull`。不要在两台机器上同时学习后再合并数据库；SQLite 是二进制文件，发生 Git 冲突时不能逐行合并，应保留指定主机器上的完整数据库。

GitHub 同步不能替代独立备份。关闭应用后复制 `backend/language_study.db` 即可备份；恢复时把备份放回相同位置。仓库必须保持 Private，数据库的 `-wal` 和 `-shm` 临时文件不会上传。
