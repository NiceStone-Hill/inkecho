# Inkecho

项目采用前后端分离架构：

- 前端：React + Vite
- 后端：Python + FastAPI
- 计划部署：GitHub Pages 部署前端，Render 部署后端

---

## 项目结构

```text
inkecho/
├── frontend/                  # React 前端
│   ├── public/
│   ├── src/
│   │   ├── App.jsx
│   │   ├── App.css
│   │   ├── index.css
│   │   └── main.jsx
│   ├── .env.local             # 本地前端环境变量，不上传 GitHub
│   ├── package.json
│   ├── package-lock.json
│   └── vite.config.js
│
├── backend/                   # FastAPI 后端
│   ├── main.py
│   ├── requirements.txt
│   ├── .env                   # 后端密钥，不上传 GitHub
│   └── .venv/                 # Python 虚拟环境，不上传 GitHub
│
├── .gitignore
└── README.md
```

---

## 开发记录

- **2026/08/05**
  - 项目目前主要在本地开发和测试，等核心功能稳定后再进行正式部署。
  - 当前前端内容只是用于验证前后端通信的基础实验框架，并非最终页面设计。
  - 开发者可以先将项目拉取到本地，在本地完成修改和测试后，再将代码提交到 GitHub。
  - 当前已经实现 React 前端、FastAPI 后端以及基础的本地前后端连接。

---

## 开发环境要求

开始开发前，请安装以下工具：

- Git
- Node.js LTS
- Python 3
- Visual Studio Code 或其他代码编辑器

可以在终端中运行以下命令，检查环境是否安装成功：

```bash
git --version
node --version
npm --version
python --version
```

Windows 用户也可以使用：

```powershell
py --version
```

---

## 获取项目

克隆 GitHub 仓库：

```bash
git clone https://github.com/NiceStone-Hill/inkecho.git
cd inkecho
```

在 VS Code 中打开项目：

```bash
code .
```

如果终端无法识别 `code` 命令，也可以在 VS Code 中选择：

```text
File → Open Folder
```

然后打开整个 `inkecho` 文件夹。

---

# 前端开发

## 1. 进入前端目录

```bash
cd frontend
```

## 2. 安装依赖

```bash
npm install
```

## 3. 配置本地环境变量

在 `frontend` 文件夹中创建：

```text
.env.local
```

填写：

```env
VITE_API_URL=http://127.0.0.1:8000
```

文件位置应为：

```text
inkecho/
└── frontend/
    ├── .env.local
    ├── package.json
    └── src/
```

注意：

- `.env.local` 不应上传到 GitHub。
- 修改 `.env.local` 后，需要重新启动 Vite。
- 所有以 `VITE_` 开头的变量都会进入浏览器代码。
- 不要在前端环境变量中保存 API Key、数据库密码或其他秘密信息。

## 4. 启动前端

```bash
npm run dev
```

启动成功后访问：

```text
http://localhost:5173/
```

停止前端服务：

```text
Ctrl + C
```

## 5. 构建静态网页

```bash
npm run build
```

构建完成后，静态文件会生成在：

```text
frontend/dist/
```

本地预览构建结果：

```bash
npm run preview
```

---

# 后端开发

## 1. 进入后端目录

从项目根目录执行：

```bash
cd backend
```

## 2. 创建 Python 虚拟环境

```bash
python -m venv .venv
```

## 3. 安装后端依赖

### Windows PowerShell

可以直接使用虚拟环境中的 Python，无须手动激活虚拟环境：

```powershell
.\.venv\Scripts\python.exe -m pip install --upgrade pip
.\.venv\Scripts\python.exe -m pip install -r requirements.txt
```

### macOS 或 Linux

激活虚拟环境：

```bash
source .venv/bin/activate
```

安装依赖：

```bash
python -m pip install --upgrade pip
python -m pip install -r requirements.txt
```

## 4. 启动后端

### Windows PowerShell

```powershell
.\.venv\Scripts\python.exe -m uvicorn main:app --reload
```

### macOS 或 Linux

```bash
python -m uvicorn main:app --reload
```

后端启动成功后，可以访问：

```text
后端首页：
http://127.0.0.1:8000/

健康检查：
http://127.0.0.1:8000/api/health

接口文档：
http://127.0.0.1:8000/docs
```

停止后端服务：

```text
Ctrl + C
```

---

# 同时运行前端和后端

本地开发时，需要同时打开两个终端窗口。

## 终端一：运行前端

```powershell
cd D:\Desktop\2025Hackthon\inkecho\frontend
npm run dev
```

## 终端二：运行后端

```powershell
cd D:\Desktop\2025Hackthon\inkecho\backend
.\.venv\Scripts\python.exe -m uvicorn main:app --reload
```

然后在浏览器中打开：

```text
http://localhost:5173/
```

本地运行结构如下：

```text
浏览器
   │
   ▼
React 前端
http://localhost:5173
   │
   │ HTTP / JSON 请求
   ▼
FastAPI 后端
http://127.0.0.1:8000
```

如果关闭了某个终端窗口，对应服务也会停止，需要重新运行启动命令。

---

# 当前 API 接口

## 健康检查

请求：

```http
GET /api/health
```

返回示例：

```json
{
  "status": "ok"
}
```

可以直接在浏览器中访问：

```text
http://127.0.0.1:8000/api/health
```

---

## 阅读阶段列表

请求：

```http
GET /api/content/stages
```

返回示例：

```json
[
  { "stage_id": 1, "title": "建立边界", "order": 1 },
  { "stage_id": 2, "title": "异常开始出现", "order": 2 },
  { "stage_id": 3, "title": "监狱系统失去解释力", "order": 3 }
]
```

---

## 单个阅读阶段内容

请求：

```http
GET /api/content/stages/{stage_id}
```

返回示例：

```json
{
  "stage_id": 1,
  "title": "建立边界",
  "order": 1,
  "segments": ["……精选原文片段……"],
  "statement_cards": [
    { "card_id": "SC01", "text": "……", "answer_type": "physical_constraint" }
  ],
  "allowed_evidence": [
    { "evidence_id": "E01", "text": "……", "source_stage": 1 }
  ]
}
```

后端只返回当前阶段允许出现的原文与证据；不接受客户端上传的证据白名单。

---

## 假说分析（默认前提探测）

请求：

```http
POST /api/analyze
Content-Type: application/json
```

请求示例：

```json
{
  "stage_id": 2,
  "hypothesis_text": "他可能是从那个排水管道爬出去的。",
  "confidence": "low"
}
```

`confidence` 取值：`low` / `medium` / `high`。

返回示例：

```json
{
  "normalized_steps": ["……", "……", "……"],
  "unsupported_assumptions": ["这条通道足以让成年人通行（尚未被文本证明）"],
  "selected_assumption": "这条通道足以让成年人通行（尚未被文本证明）",
  "question": "文本只说明这个孔洞的存在，你怎么确认它能容纳一个成年人通过？",
  "category": "physical_path",
  "rationale_evidence_ids": ["E05"],
  "fallback": false
}
```

- `fallback` 为 `true` 时表示模型调用失败或未配置密钥，系统改用关键词兜底分类器返回安全问题，不影响用户继续完成体验。
- `rationale_evidence_ids` 只会包含当前 `stage_id` 允许的证据 ID。

可以通过 FastAPI 自动生成的接口文档测试以上全部接口：

```text
http://127.0.0.1:8000/docs
```

---

## 谜底解决链

请求：

```http
GET /api/solution
```

返回示例：

```json
{
  "steps": [
    { "step_id": 1, "text": "……", "evidence_ids": ["E04", "E05"] }
  ]
}
```

谜底内容全部由人工审核维护，不经过模型生成。

---

# 前后端通信方式

前端通过 HTTP 请求调用后端接口，所有请求封装在 `frontend/src/api.js` 中。

前端请求示例（提交假说并请求分析）：

```javascript
import { analyzeHypothesis } from "./api";

const result = await analyzeHypothesis({
  stageId: 2,
  hypothesisText: "他可能是从那个排水管道爬出去的。",
  confidence: "low",
});
```

前端实际发送的请求体：

```json
{
  "stage_id": 2,
  "hypothesis_text": "他可能是从那个排水管道爬出去的。",
  "confidence": "low"
}
```

后端返回的数据结构参见上文“假说分析（默认前提探测）”一节。

前端主要负责：

- 页面布局和视觉设计
- 用户输入和按钮交互
- 加载状态和错误提示
- 向后端发送 HTTP 请求
- 展示后端返回的数据

后端主要负责：

- 定义 API 接口
- 校验请求数据
- 执行业务逻辑
- 调用 AI 服务
- 访问数据库
- 保存和保护密钥
- 返回结构化 JSON 数据

---

# 环境变量

## 前端环境变量

本地前端环境变量保存在：

```text
frontend/.env.local
```

示例：

```env
VITE_API_URL=http://127.0.0.1:8000
```

前端环境变量会被浏览器读取，因此不能保存秘密信息。

不要这样配置：

```env
VITE_OPENAI_API_KEY=your-secret-key
```

## 后端环境变量

后端秘密信息应保存在：

```text
backend/.env
```

当前使用：

```env
OPENAI_API_KEY=your-secret-key
AI_BASE_URL=https://api.openai.com/v1
AI_MODEL=gpt-4o-mini
AI_TIMEOUT_SECONDS=10
```

说明：

- `OPENAI_API_KEY` 未配置或为空时，`/api/analyze` 会自动使用关键词兜底分类器，不会报错，也不会中断体验。
- `AI_BASE_URL` 和 `AI_MODEL` 可以按需替换为其他兼容 OpenAI Chat Completions 接口格式的模型服务。
- `AI_TIMEOUT_SECONDS` 控制模型调用的超时时间，超时会自动降级为兜底问题。

后端 `.env` 文件不能上传到 GitHub。可以参考 `backend/.env.example` 创建自己的本地配置。

未来部署到 Render 后，应在 Render 控制台中配置环境变量，而不是将密钥直接写入代码或上传到 GitHub。

---

# CORS 跨域配置

本地开发时，前端和后端使用不同地址：

```text
前端：http://localhost:5173
后端：http://127.0.0.1:8000
```

浏览器会将它们视为不同来源，因此 FastAPI 后端需要允许本地前端访问。

本地开发地址（`http://localhost:5173`、`http://127.0.0.1:5173`）已经在
`backend/main.py` 中硬编码默认允许，无需额外配置。

正式前端域名（例如部署到 GitHub Pages 后的地址）通过环境变量 `ALLOWED_ORIGINS`
追加，多个地址用逗号分隔，写在 `backend/.env` 中：

```env
ALLOWED_ORIGINS=https://NiceStone-Hill.github.io
```

不在允许列表中的来源发起的请求会被浏览器拦截（对应产品需求文档 AC12：
正式Origin可调用，其他Origin被拒绝）。

---

# Git 开发流程

## 拉取最新代码

开始开发前运行：

```bash
git pull
```

## 创建开发分支

开发新功能时，建议创建独立分支：

```bash
git switch -c feature/example-feature
```

例如：

```bash
git switch -c feature/text-analysis
```

## 查看修改状态

```bash
git status
```

## 提交代码

```bash
git add .
git commit -m "Add example feature"
```

## 推送分支

```bash
git push -u origin feature/example-feature
```

推荐使用清晰的提交信息，例如：

```text
Add local echo API
Improve landing page layout
Fix frontend backend connection
Add input validation
Configure production API URL
```

---

# 不应上传到 GitHub 的文件

以下内容不能提交到 GitHub：

```text
frontend/node_modules/
frontend/dist/
frontend/.env.local

backend/.venv/
backend/.env
backend/__pycache__/
```

项目根目录的 `.gitignore` 建议包含：

```gitignore
# Frontend
frontend/node_modules/
frontend/dist/
frontend/.env.local
frontend/.env.*.local

# Backend
backend/.venv/
backend/__pycache__/
backend/*.pyc
backend/.env

# Editor and operating system
.vscode/
.DS_Store
Thumbs.db
```

---

# 常见问题

## 前端无法打开

确认前端开发服务器已经运行：

```bash
cd frontend
npm run dev
```

然后访问：

```text
http://localhost:5173/
```

---

## 前端显示无法连接后端

确认后端正在运行：

```powershell
cd backend
.\.venv\Scripts\python.exe -m uvicorn main:app --reload
```

访问健康检查接口：

```text
http://127.0.0.1:8000/api/health
```

正常情况下应显示：

```json
{
  "status": "ok"
}
```

同时确认：

```text
frontend/.env.local
```

包含：

```env
VITE_API_URL=http://127.0.0.1:8000
```

修改环境变量后，需要停止并重新启动前端：

```text
Ctrl + C
```

然后运行：

```bash
npm run dev
```

---

## PowerShell 无法激活虚拟环境

不需要激活，可以直接使用虚拟环境中的 Python：

```powershell
.\.venv\Scripts\python.exe -m uvicorn main:app --reload
```

安装依赖：

```powershell
.\.venv\Scripts\python.exe -m pip install -r requirements.txt
```

---

## 浏览器出现 CORS 错误

本地开发地址（`http://localhost:5173`、`http://127.0.0.1:5173`）默认已被允许。

如果是部署后的正式前端域名报错，检查 `backend/.env` 中的 `ALLOWED_ORIGINS`
是否包含该域名，例如：

```env
ALLOWED_ORIGINS=https://NiceStone-Hill.github.io
```

修改后重新启动后端。

---

## 端口已被占用

可以先在运行服务的终端中按：

```text
Ctrl + C
```

停止原来的服务。

也可以使用其他端口启动后端：

```bash
python -m uvicorn main:app --reload --port 8001
```

然后同步修改：

```text
frontend/.env.local
```

```env
VITE_API_URL=http://127.0.0.1:8001
```

---

# 计划部署结构

未来计划使用以下部署方式：

```text
GitHub Pages
React 前端
https://NiceStone-Hill.github.io/inkecho/
          │
          │ HTTPS API 请求
          ▼
Render
FastAPI 后端
https://inkecho-api.onrender.com
```

前端和后端继续保存在同一个 GitHub 仓库中。

部署时：

```text
GitHub Pages 只构建 frontend/
Render 只运行 backend/
```

Render 配置中将根目录设置为：

```text
backend
```

前端生产环境将使用类似下面的后端地址：

```env
VITE_API_URL=https://inkecho-api.onrender.com
```

在本地功能稳定之前，暂不进行正式部署。

### 子路径部署的两个关键点（对应 AC11）

GitHub Pages 是纯静态托管，仓库地址会把前端部署在子路径下（`/inkecho/`），
且没有服务端路由回退能力。为了保证刷新和直接访问任意页面都不会出现空白或 404，
项目做了两处约定，未来改动时需要保持一致：

1. `frontend/vite.config.js` 中 `base` 在生产构建时固定为 `/inkecho/`。
   如果仓库名变化，需要同步修改这里，否则构建产物引用的 JS/CSS 路径会 404。
2. `frontend/src/main.jsx` 使用 `HashRouter` 而不是 `BrowserRouter`。
   路由状态放在 URL hash 里（例如 `/inkecho/#/read`），刷新或直接访问任意子路径
   都只会请求同一个 `index.html`，不依赖服务器端的路由重写规则。

---

# 当前开发状态

项目目前已经实现《前提之外｜UNPROVEN》P0 主流程（对应产品需求文档第5、7章）：

- 六页体验：进入页、精选阅读页（3阶段+事实/前提陈述卡）、假说v1页、压力测试页、修正v2页、谜底与回放页
- 前端路由与阶段守卫（React Router + localStorage），刷新或直接跳转URL会被带回最近完整检查点
- 后端 WorkPack 内容（3段精选原文、9条证据、3张陈述卡、5类压力问题模板、5步人工解决链、禁剧透词表）
- `/api/analyze` 唯一AI调用：假说结构化、默认前提探测、压力问题生成，并对模型输出做证据边界校验、禁词校验
- 模型不可用或未配置密钥时，自动降级为关键词兜底分类器，保证不同类别假说仍能得到不同问题
- 谜底 `/api/solution` 由人工数据维护，不经过模型生成

下一步计划：

- 用户测试与内容红队（不同假说样本、防剧透用例）
- 手写签名与分享卡（P1，可选）
- 部署后端到 Render、前端到 GitHub Pages
- 补充自动化测试（状态迁移、证据白名单、禁词校验）

---

# 贡献说明

提交代码前请确保：

1. 前端可以正常启动
2. 后端可以正常启动
3. `/api/health` 能够正常返回
4. 前端能够成功调用后端
5. 没有提交 API Key、数据库密码或其他密钥
6. 没有提交 `node_modules`、`.venv` 和构建文件
7. 页面修改附带必要的截图
8. API 修改说明请求参数和返回格式

---

# License

当前项目暂未选择开源许可证。

在正式公开发布或接受外部贡献前，需要添加合适的 `LICENSE` 文件。