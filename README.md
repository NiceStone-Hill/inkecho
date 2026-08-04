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

## 创建文字回声

请求：

```http
POST /api/echo
Content-Type: application/json
```

请求示例：

```json
{
  "text": "Hello Inkecho"
}
```

返回示例：

```json
{
  "reply": "这是后端返回的回声：Hello Inkecho"
}
```

可以通过 FastAPI 自动生成的接口文档测试：

```text
http://127.0.0.1:8000/docs
```

测试步骤：

1. 找到 `POST /api/echo`
2. 点击 `Try it out`
3. 输入请求内容
4. 点击 `Execute`
5. 查看后端返回结果

---

# 前后端通信方式

前端通过 HTTP 请求调用后端接口。

前端请求示例：

```javascript
const response = await fetch(`${API_URL}/api/echo`, {
  method: "POST",
  headers: {
    "Content-Type": "application/json",
  },
  body: JSON.stringify({
    text: text,
  }),
});

const data = await response.json();
```

前端发送的数据：

```json
{
  "text": "今天发生了一件有趣的事情"
}
```

后端返回的数据：

```json
{
  "reply": "这是后端返回的回声：今天发生了一件有趣的事情"
}
```

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

未来可能使用：

```env
OPENAI_API_KEY=your-secret-key
DATABASE_URL=your-database-url
```

后端 `.env` 文件不能上传到 GitHub。

未来部署到 Render 后，应在 Render 控制台中配置环境变量，而不是将密钥直接写入代码或上传到 GitHub。

---

# CORS 跨域配置

本地开发时，前端和后端使用不同地址：

```text
前端：http://localhost:5173
后端：http://127.0.0.1:8000
```

浏览器会将它们视为不同来源，因此 FastAPI 后端需要允许本地前端访问。

示例：

```python
from fastapi.middleware.cors import CORSMiddleware

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",
        "http://127.0.0.1:5173",
    ],
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)
```

未来前端部署到 GitHub Pages 后，还需要将正式前端域名加入后端允许的来源列表。

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

检查 FastAPI 的 `CORSMiddleware` 是否允许：

```text
http://localhost:5173
http://127.0.0.1:5173
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

---

# 当前开发状态

项目目前已经实现：

- React 前端本地运行
- FastAPI 后端本地运行
- 前端检查后端状态
- 前端向后端发送文字
- 后端返回基础回声结果
- 使用环境变量配置本地后端地址

下一步计划：

- 完善 Inkecho 的页面设计与交互体验
- 明确项目的核心使用流程
- 接入 AI 文本分析或生成能力
- 增加数据保存功能
- 配置数据库
- 完善输入校验和错误处理
- 部署后端到 Render
- 部署前端到 GitHub Pages

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