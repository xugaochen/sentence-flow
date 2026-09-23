# 句流 · 个人语言学习工具

一个以“主动输出”为核心的外语学习本地 Web 应用，目前支持日语、西班牙语和英语。看到中文提示后，尝试完整输入目标语言；提交后查看标准答案，再自己评价“会了 / 模糊 / 不会”。完全想不起来时，也可以直接揭晓答案并自评。

句子始终是核心。单词只能由你从句子详情中手动挑选，并通过多对多关系保留一个或多个来源句。

## 已实现功能

- 句子的添加、查看、编辑、移至回收站、搜索及语言 / 标签 / 熟练度筛选
- 句子主动输入复习；忽略首尾空白并统一 Unicode NFC，提交后用红色和绿色标出字符差异
- “会了 / 模糊 / 不会”自评，句子和单词统一使用“近期巩固 / 久未复习”两种模式，优先覆盖当天没练过的内容
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
- 首页句子数、语言分布、单词数、今日不同句子/单词覆盖量及作答次数统计
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
│  │  │  ├─ reviews.py       # 复习抽题、可练数量和复习记录 API
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

前端测试与生产构建检查：

```powershell
cd frontend
npm test
npm run build
```

## 复习方式

句子和单词复习均默认使用“近期巩固”。设置页选择语言、模式与数量；单词还可按词性筛选。模式卡会显示当前范围内本轮可练的数量。

| 模式 | 哪些内容会出现 | 顺序 |
| --- | --- | --- |
| 近期巩固 | 最近 7 天练过、现在仍不会或模糊的内容，以及尚未练过且未标记会了的内容 | 优先今天尚未完成的题，同层随机 |
| 久未复习 | 距上次实际复习至少 7 天的内容，不限熟练度 | 间隔天数越长越优先，同一天数内随机 |

7 天按实际经过时间计算，与加入句子库或单词库的时间无关。近期已经会了的题先休息，满 7 天再进入久未复习；久未题答完仍不会或模糊，则在下一轮进入近期巩固。手动修改熟练度也会影响下轮的候选内容。

每轮每题只出现一次，当天最多安排两次。近期巩固只要还有今天没练过的候选，本轮就只抽这些题；这一层全部覆盖后，再开一轮才安排仍不会或模糊的题做第二遍。久未复习不会抽今天已经完成的题。两种模式共用每题的今日计数，重启程序或刷新网页不会清零。

数量可以选择 10、20、30 或“本轮全部”。全部指当前可抽取层每题一遍；候选不足时，本轮会相应缩短，不会用第二遍或另一模式的题凑数。没有可练内容时，页面会说明原因并提供切换模式的入口。

“想不起来，查看答案”允许空答案揭晓，随后仍需自行选择熟练度。跳过和仅揭晓都不会记录复习，跳过的题在下一轮可能再次出现。只有成功保存熟练度才计一次作答：同一天完成同一句两遍，统计为覆盖 1 个句子、作答 2 次。回收站内容不计入可练数量和今日覆盖统计。

首页显示全部语言的今日覆盖量；复习设置与完成页显示当前语言范围的统计，单词词性筛选只影响单词统计。今日以运行后端的电脑的本地自然日为准，于当地午夜重新计算；不同机器的系统时区应保持一致。每轮开始重新读取记录并生成队列，建议同时只使用一个复习页面。

### 复习快捷键

| 按键 | 操作 |
| --- | --- |
| `Ctrl/Cmd + Enter` | 提交答案；单词复习也可直接按 `Enter` |
| `Ctrl/Cmd + /` | 作答阶段“想不起来，查看答案”，允许空答案；仍需自评才记录复习 |
| `Ctrl/Cmd + Shift + Enter` | 作答阶段跳过当前题 |
| `1` / `2` / `3` | 揭晓后选择会了 / 模糊 / 不会，并进入下一题 |
| `R` | 揭晓后朗读 / 停止朗读 |

编辑句子、注释、单词及朗读设置的输入控件时，数字键和 `R` 不触发复习操作。
输入法正在选字、按键长按重复或正在保存时，不触发复习快捷键。

### 工作台模式

在首页点击“⌘ 工作台模式”（也可用顶部“⌘ 工作台”），界面会切换为代码编辑器风格：深色主题、侧边导航、编辑器标签、行号、等宽输入和差异比较。浏览器标签页标题也会变为 `workspace — Code Workspace`。

- 导航使用可读英文：`Home`、`Sentence Review`、`Word Review`、`Sentence Library`、`Word Library`、`Data & Backup`，不再使用需要猜含义的假文件名。
- 复习、编辑、朗读设置等操作使用简单英文；自评为 `1 Know it`（会了）、`2 Unsure`（模糊）、`3 Not yet`（不会）。内容中的中文翻译、个人注释和自定义标签保持原样，不会被自动翻译或删除。
- 切换只改变显示，不重新加载页面、不清空当前答案，也不改变复习队列或数据。点击顶部 `Standard View` 可随时切回中文标准界面。
- 外观选择保存在当前浏览器的 `localStorage`，刷新后保留，不写入数据库或同步到 GitHub；浏览器禁止存储时，当前页面仍可切换。
- 这是一种外观模式，不是隐私屏障：原句、中文、URL、朗读声音和学习记录仍然存在，不会隐藏或加密。

### 西语句子的提示语言

1. 进入句子复习，语言选择“西班牙语 / Spanish”。
2. 在“提示语言 / Prompt Language”选择“中文 → 西语 / Chinese → Spanish”或“英语 → 西语 / English → Spanish”。
3. 选择复习方式和数量，开始后根据相应翻译写出西语原句；切回设置可以更换提示语言。

- 标准界面和工作台都可独立选择提示语言，外观切换不会改变这个选择。默认中文，当前复习页面内保留选择，不写入永久设置；“全部语言”、日语、英语以及单词复习仍使用原有提示。
- 句子新增独立的可选字段 `english_text`。西语句子的新增/编辑页和复习时的“修改翻译 / Edit Translations”均可编辑英文；详情页也会展示英文。中文、原文、注释和历史记录保留。
- 英文提示模式只抽取已填写英文翻译的西语句子；缺译数量会明确提示，可补译或改用中文，不会偷偷回退为中文。语义相同的西语表达可能不唯一，差异比较仍使用保存的单一标准答案，自评由你决定。
- 两种提示语言共用熟练度、复习记录和每天最多两次的安排限制。今日覆盖和作答数统计当前语言范围的全部记录，不会因为切换提示语言而重新计数。
- 首次升级自动增量添加字段，旧数据为空。本次已为当前数据库的西语句子补齐英文，包括回收站中的西语句子；以后新增的句子需要自行填写英文，不依赖在线翻译、API 或额外账号。
- 句子搜索同时匹配英文。JSON/CSV 导出包含 `english_text`，导出版本为 `3`；上传数据库或迁移数据库时译文会一起保留。
- API：西语句子抽题及概览接受 `language=es&prompt_language=en`；默认 `prompt_language=zh`。旧客户端更新句子时不传 `english_text` 会保留已有英文，显式传空字符串则清空。

## 数据和规则说明

- 数据库语言代码为 `ja`、`es` 和 `en`，界面显示“日语”“西班牙语”和“英语”。
- 熟练度保存为 `unknown`、`fuzzy`、`known`，界面显示“不会”“模糊”“会了”。
- 复习界面显式使用 `mode=recent` 或 `mode=older`；旧 API 的 `smart`、`weighted`、`uniform`、`new_first` 和未传模式时的 `weighted` 默认值保留兼容，旧模式不使用新版日内限制。
- `GET /api/reviews/sentences/overview` 和 `GET /api/reviews/words/overview` 返回模式可练数量、空状态原因及今日覆盖/作答统计；抽题仍使用原来的列表接口，记录仍使用原来的自评接口。本次抽题升级直接使用已有复习记录，无需迁移学习数据。
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
