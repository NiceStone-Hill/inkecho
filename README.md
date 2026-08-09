# UNPROVEN

UNPROVEN 是一个面向推理阅读场景的 AI 前提审查系统。

它关注的不是“尽快告诉用户正确答案”，而是记录并推动用户在阅读过程中的认知变化：用户读到了什么、注意到了什么、形成了什么解释，以及新证据出现后这些解释如何被修正。

项目采用前后端分离架构：

- 前端：React + Vite
- 后端：Python + FastAPI
- Pressure Test Agent：OpenAI-compatible Chat Completions 接口
- 手写识别：PaddleOCR `PP-OCRv5_mobile_rec` 本地推理
- 本地状态：`localStorage`
- 计划部署：GitHub Pages 部署前端，支持 Python / PaddleOCR 的后端服务部署 FastAPI

---

# 核心设计

UNPROVEN 将阅读过程中的信息分成不同层级，并严格控制 AI 能够访问的内容。

## Source

故事的原始事实来源。

## Reading

用户当前实际看到的文字内容。

## Evidence

机器可以使用的事实层。

只有用户已经读到并解锁的 Evidence 才允许进入 Agent 上下文。

## Checkpoint

阅读过程中的关键认知节点。

系统会在这些位置邀请用户保存或修正当前观点。

## Hypothesis

用户对故事当前形成的解释。

Hypothesis 不是事实，而是 Pressure Test Agent 需要检验的对象。

## Annotation

用户阅读过程中产生的认知痕迹，包括：

- 高亮
- 键盘批注
- 手写批注
- 用户自己的猜测
- 用户当前关注的文本

Annotation 只表示：

```text
“用户正在注意什么？”
“用户可能怎样理解？”
```

Annotation 不能被 Agent 当作故事事实。

---

# 阅读流程

```text
Source
  ↓
Reading
  ↓
Evidence 随阅读进度解锁
  ↓
Checkpoint
  ↓
保存 Hypothesis
  ↓
继续阅读
  ↓
新 Evidence + Annotation
  ↓
Pressure Test Agent
  ↓
用户重新思考
  ↓
形成新的 Hypothesis
```

当前主要认知版本为：

```text
Checkpoint 1
    ↓
Hypothesis V1

继续阅读 + 新 Evidence
    ↓
Pressure Test
    ↓
用户确认 / 修正
    ↓
Hypothesis V2

继续阅读 + 新 Evidence
    ↓
Pressure Test
    ↓
用户确认 / 修正
    ↓
Hypothesis V3
```

需要注意：

> 用户回答 Pressure Test 的问题，并不自动等于形成了新的 Hypothesis。

用户需要再次确认或修改自己的解释后，系统才保存新的版本。

---

# Pressure Test Agent

Pressure Test Agent 的职责不是解谜，也不是判断用户对错。

它只负责：

> 根据用户当前的 Hypothesis、已经解锁的 Evidence 和用户自己的 Annotation，找到当前解释中最值得检验的一个前提，并生成一个中性的压力问题。

## Agent 输入

```text
Current Hypothesis
        +
Unlocked Evidence
        +
New Evidence
        +
Reader Annotations
        +
Current Checkpoint
        ↓
Deterministic Context Builder
        ↓
Pressure Test Agent
```

## 信息边界

Agent 必须区分三类信息。

### Evidence

已经解锁的故事事实。

只有 Evidence 可以作为事实使用。

### Annotation

用户自己的注意、划线、批注、手写和猜测。

Annotation 不是事实。

### Hypothesis

用户当前对故事的解释。

Hypothesis 同样不是事实。

---

# Pressure Test 输入边界

Pressure Test 只在 CP2 运行一次。后端固定装入 E01—E03，不接受客户端上传或扩大 Evidence 白名单。

模型只会收到：

- Hypothesis V1 文本与确信度
- E01、E02、E03

小说全文、Solution 和 Annotation 都不会进入 Pressure Test 上下文。

---

# Pressure Test 问题生成

## 正常模式

正常情况下，反馈问题由 LLM 动态生成。

```text
Hypothesis V1 + E01—E03
    ↓
LLM 分析
    ↓
selected_assumption
↓
动态生成 pressure_question
```

因此，系统正常运行时并不是从一组固定问题中选择一个问题。

## Fallback 模式

以下任一情况都直接返回固定 `UNCLEAR` 问题：

- 没有配置 AI API Key
- 模型调用超时
- HTTP 请求失败
- 返回内容不是合法 JSON
- 模型输出字段不符合要求
- 引用了未解锁 Evidence
- 输出触发剧透安全检查
- 用户输入过短或无法可靠识别前提

此时系统才会进入：

```text
selected_assumption = null
category = UNCLEAR
pressure_question = 固定问题
```

不再通过关键词硬猜类别或解法。

---

# Reader Annotation

用户可以选中阅读文本并添加批注。

目前支持两种输入方式。

## 键盘批注

```text
选中文字
    ↓
输入文字
    ↓
Annotation.note
```

## 手写批注

```text
选中文字
    ↓
Handwriting Canvas
    ↓
保存 strokes
    ↓
前端渲染为白底黑字 PNG
    ↓
POST /api/ocr/handwriting
    ↓
本地 PP-OCRv5_mobile_rec
    ↓
识别文字 + confidence
    ↓
用户确认或修改
    ↓
Annotation.note
```

手写模式同时保留：

- 原始笔迹 `strokes`
- OCR 后并由用户确认的文字 `note`

后续 Agent 直接读取 `Annotation.note`，不需要再次处理手写图片。

---

# 本地手写 OCR

InkEcho 使用 PaddleOCR 的：

```text
PP-OCRv5_mobile_rec
```

进行本地手写文字识别。

当前方案：

- 不需要额外 OCR API
- 不需要额外 OCR API Key
- 不需要自己训练模型
- 模型首次运行时自动下载
- 后续从本地缓存加载
- 适合短句、单行中文手写批注

## OCR 流程

```text
Handwriting Canvas
        ↓
strokes
        ↓
前端生成小尺寸白底黑字 PNG
        ↓
FastAPI
        ↓
PaddleOCR TextRecognition
        ↓
rec_text + rec_score
        ↓
用户确认 / 修改
        ↓
Annotation.note
```

当前使用的是 recognition-only 方案，因为 InkEcho 的手写区域本身已经是一个独立的小 Canvas，不需要先在整张图片中寻找文字区域。

如果未来支持多行长手写内容，可以升级为：

```text
Text Detection
    ↓
Line Segmentation
    ↓
Text Recognition
```

---

# Checkpoint 交互

系统不会在用户到达 Checkpoint 时立即强制弹出大型输入框。

当前交互采用轻量通知：

```text
阅读到 Checkpoint
    ↓
右下角出现 InkEcho 提醒
    ↓
用户点击
    ↓
打开 Checkpoint 面板
```

通知支持：

- 点击打开
- 点击 `×` 手动关闭
- 不阻止用户继续阅读
- 30 秒后自动消失

当前自动消失时间：

```javascript
30000 // 30 seconds
```

---

# 项目结构

```text
inkecho/
├── frontend/
│   ├── public/
│   ├── src/
│   │   ├── components/
│   │   │   ├── AnnotationLayer.jsx
│   │   │   ├── AnnotationsPanel.jsx
│   │   │   └── HandwritingCanvas.jsx
│   │   ├── pages/
│   │   │   ├── WorkspacePage.jsx
│   │   │   ├── pages.css
│   │   │   └── checkpoint.css
│   │   ├── state/
│   │   │   ├── ProgressContext.jsx
│   │   │   └── progress.js
│   │   ├── api.js
│   │   ├── App.jsx
│   │   ├── App.css
│   │   ├── index.css
│   │   └── main.jsx
│   ├── .env.local
│   ├── package.json
│   ├── package-lock.json
│   └── vite.config.js
│
├── backend/
│   ├── ai_service.py
│   ├── content.py
│   ├── tests/
│   ├── handwriting_service.py
│   ├── main.py
│   ├── schemas.py
│   ├── state_store.py
│   ├── requirements.txt
│   ├── .env
│   └── .venv/
│
├── .gitignore
└── README.md
```

---

# 开发环境要求

开始开发前，请安装：

- Git
- Node.js LTS
- Python 3
- Visual Studio Code 或其他代码编辑器

检查：

```bash
git --version
node --version
npm --version
python --version
```

Windows 用户也可以：

```powershell
py --version
```

---

# 获取项目

```bash
git clone https://github.com/NiceStone-Hill/inkecho.git
cd inkecho
```

在 VS Code 中打开：

```bash
code .
```

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

## 3. 配置环境变量

创建：

```text
frontend/.env.local
```

填写：

```env
VITE_API_URL=http://127.0.0.1:8000
```

注意：

- `.env.local` 不应上传 GitHub
- 修改 `.env.local` 后需要重启 Vite
- 所有 `VITE_` 开头的变量都会进入浏览器
- 不要把 API Key 放在前端环境变量中

## 4. 启动前端

```bash
npm run dev
```

访问：

```text
http://localhost:5173/
```

## 5. 构建前端

```bash
npm run build
```

构建结果：

```text
frontend/dist/
```

本地预览：

```bash
npm run preview
```

---

# 后端开发

## 1. 进入后端目录

```bash
cd backend
```

## 2. 创建虚拟环境

第一次运行：

```bash
python -m venv .venv
```

Windows PowerShell 激活：

```powershell
.\.venv\Scripts\Activate.ps1
```

成功后应看到：

```text
(.venv) PS ...
```

检查当前 Python：

```powershell
python -c "import sys; print(sys.executable)"
```

输出应指向：

```text
...\inkecho\backend\.venv\Scripts\python.exe
```

而不是：

```text
...\Anaconda\python.exe
```

如果 PowerShell 禁止执行脚本：

```powershell
Set-ExecutionPolicy -Scope Process -ExecutionPolicy Bypass
```

然后再次激活：

```powershell
.\.venv\Scripts\Activate.ps1
```

---

## 3. 安装 PaddlePaddle

当前 OCR 使用 CPU 版 PaddlePaddle。

先升级 pip：

```powershell
python -m pip install --upgrade pip
```

安装 PaddlePaddle CPU：

```powershell
python -m pip install paddlepaddle==3.3.0 -i https://www.paddlepaddle.org.cn/packages/stable/cpu/
```

然后安装项目依赖：

```powershell
python -m pip install -r requirements.txt
```

当前 `backend/requirements.txt` 应至少包含：

```text
fastapi
uvicorn[standard]
pydantic
python-dotenv
httpx
paddleocr
pillow
numpy
```

---

## 4. 验证 PaddlePaddle

```powershell
python -c "import paddle; print(paddle.__file__)"
```

路径应该位于：

```text
backend\.venv\Lib\site-packages\paddle\
```

然后运行：

```powershell
python -c "import paddle; paddle.utils.run_check()"
```

正常情况下应看到：

```text
PaddlePaddle is installed successfully!
```

如果出现：

```text
No ccache found
```

目前只是 warning，不影响 CPU 推理。

---

## 5. 验证 OCR 模型

```powershell
python -c "from paddleocr import TextRecognition; model=TextRecognition(model_name='PP-OCRv5_mobile_rec', device='cpu'); print('OCR model ready')"
```

第一次运行会下载模型。

之后再次运行会直接使用本地缓存。

---

## 6. 启动后端

```powershell
python -m uvicorn main:app --reload
```

访问：

```text
后端首页：
http://127.0.0.1:8000/

健康检查：
http://127.0.0.1:8000/api/health

接口文档：
http://127.0.0.1:8000/docs

AI 状态：
http://127.0.0.1:8000/api/ai/status
```

---

# 同时运行前端和后端

本地开发需要两个终端。

## 终端一：后端

```powershell
cd D:\Desktop\2026Hackthon\inkecho\backend
.\.venv\Scripts\Activate.ps1
python -m uvicorn main:app --reload
```

## 终端二：前端

```powershell
cd D:\Desktop\2026Hackthon\inkecho\frontend
npm run dev
```

访问：

```text
http://localhost:5173/
```

---

# 当前 API

## 健康检查

```http
GET /api/health
```

返回：

```json
{
  "status": "ok"
}
```

---

## AI 状态

```http
GET /api/ai/status
```

开发阶段可以通过它判断最近一次 Pressure Test 是否使用了正常模型路径。

示例：

```json
{
  "mode": "model",
  "last_success": true,
  "last_error": null,
  "last_fallback": false
}
```

如果：

```json
{
  "last_fallback": true
}
```

说明最近一次问题可能来自 fallback，而不是 LLM 正常动态生成。

---

## 阅读阶段列表

```http
GET /api/content/stages
```

---

## 单个阅读阶段

```http
GET /api/content/stages/{stage_id}
```

后端只返回当前阅读阶段允许出现的内容。

客户端不能自行扩大 Evidence 范围。

---

## Pressure Test

```http
POST /api/analyze
Content-Type: application/json
```

请求示例：

```json
{
  "checkpoint_id": "CP2",
  "hypothesis_v1": {
    "text": "他发现边界通道后，会把洞扩大，然后从那里爬出去。",
    "confidence": "medium"
  }
}
```

返回示例：

```json
{
  "selected_assumption": "用户默认供老鼠通过的边界通道也足以让范·杜森本人通行。",
  "category": "HUMAN_PASSAGE",
  "pressure_question": "你的方案把老鼠能够通过进一步理解成了人也能通过，目前文本真的证明了这一步吗？",
  "rationale_evidence_ids": ["E02"]
}
```

说明：

- `rationale_evidence_ids` 只能引用 E01—E03
- 无法可靠判断或模型失败时，返回固定 `UNCLEAR` 结果

---

## 手写 OCR

```http
POST /api/ocr/handwriting
Content-Type: application/json
```

请求：

```json
{
  "image_data_url": "data:image/png;base64,..."
}
```

返回：

```json
{
  "transcript": "可能有其他通道",
  "confidence": 0.91
}
```

OCR 在后端本地执行，不调用额外云 OCR 服务。

---

## Annotation

Annotation 用于记录：

- 用户选中的文本
- 键盘笔记
- 手写笔迹
- OCR 后的文字

示例：

```json
{
  "stage_id": 4,
  "segment_index": 2,
  "quote": "选中的原文",
  "note": "可能有其他通道",
  "input_mode": "draw",
  "strokes": []
}
```

对于手写批注：

```text
strokes
```

保存原始笔迹。

```text
note
```

保存 OCR 后并由用户确认的文字。

后续 Agent 读取 `note`，但仍将它视为用户认知线索，而不是 Evidence。

---

## 谜底解决链

```http
GET /api/solution
```

谜底内容由人工维护，不经过模型生成。

---

# 前后端通信

前端通过 HTTP 请求调用后端接口。

主要请求封装在：

```text
frontend/src/api.js
```

前端主要负责：

- 阅读界面
- Checkpoint 交互
- 用户输入
- Annotation
- 手写 Canvas
- OCR 结果确认
- V1 / V2 / V3 展示
- 请求状态与错误提示

后端主要负责：

- API
- 数据校验
- Content / Evidence
- Context Builder
- Pressure Test Agent
- Annotation 存储
- PaddleOCR
- 剧透安全检查
- 返回结构化 JSON

---

# 环境变量

## 前端

```text
frontend/.env.local
```

示例：

```env
VITE_API_URL=http://127.0.0.1:8000
```

不要在前端保存：

```env
VITE_OPENAI_API_KEY=...
```

## 后端

```text
backend/.env
```

示例：

```env
OPENAI_API_KEY=your-secret-key
AI_BASE_URL=https://api.openai.com/v1
AI_MODEL=gpt-4o-mini
AI_TIMEOUT_SECONDS=10

HANDWRITING_OCR_MODEL=PP-OCRv5_mobile_rec
HANDWRITING_OCR_DEVICE=cpu
HANDWRITING_OCR_CPU_THREADS=4
```

说明：

- `OPENAI_API_KEY`：Pressure Test Agent 使用
- `AI_BASE_URL`：OpenAI-compatible Chat Completions 地址
- `AI_MODEL`：Pressure Test 使用的模型
- `AI_TIMEOUT_SECONDS`：模型调用超时
- OCR 不需要额外 API Key
- `.env` 不能上传 GitHub

---

# CORS

本地开发：

```text
前端：http://localhost:5173
后端：http://127.0.0.1:8000
```

正式部署时，可以在：

```text
backend/.env
```

增加：

```env
ALLOWED_ORIGINS=https://NiceStone-Hill.github.io
```

多个地址使用逗号分隔。

---

# Git 开发流程

## 拉取更新

```bash
git pull
```

## 创建分支

```bash
git switch -c feature/example-feature
```

## 将现有分支同步到 main

例如当前分支是：

```text
cqx
```

可以：

```bash
git switch cqx
git fetch origin
git merge origin/main
```

或者：

```bash
git switch cqx
git fetch origin
git rebase origin/main
```

## 提交

```bash
git status
git add .
git commit -m "Update InkEcho agent and handwriting annotation"
git push
```

---

# 不应上传到 GitHub 的内容

```text
frontend/node_modules/
frontend/dist/
frontend/.env.local

backend/.venv/
backend/.env
backend/__pycache__/
backend/*.pyc
```

推荐 `.gitignore`：

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

# Editor / OS
.vscode/
.DS_Store
Thumbs.db
```

---

# 常见问题

## 前端无法连接后端

检查：

```text
http://127.0.0.1:8000/api/health
```

同时检查：

```text
frontend/.env.local
```

是否为：

```env
VITE_API_URL=http://127.0.0.1:8000
```

修改后需要重启 Vite。

---

## Pressure Test 连续出现相同问题

检查：

```text
http://127.0.0.1:8000/api/ai/status
```

如果：

```json
{
  "last_fallback": true
}
```

说明当前问题很可能来自 fallback。

应优先检查：

- API Key
- AI Base URL
- 模型请求是否超时
- 返回 JSON 格式
- Evidence ID 校验
- `pressure_question` 长度与单问句校验
- spoiler 检查

而不是优先增加更多固定问题模板。

---

## PaddleOCR 出现 OpenMP 冲突

如果终端前缀是：

```text
(base)
```

说明当前可能使用的是 Anaconda base。

建议：

```powershell
conda deactivate
.\.venv\Scripts\Activate.ps1
```

然后：

```powershell
python -c "import sys; print(sys.executable)"
```

必须指向：

```text
backend\.venv\Scripts\python.exe
```

不要依赖 `KMP_DUPLICATE_LIB_OK=TRUE` 作为正式运行方案。

---

## `No ccache found`

如果看到：

```text
UserWarning: No ccache found
```

目前只是 warning，不影响 CPU OCR 推理。

---

## OCR 第一次运行较慢

第一次需要下载：

```text
PP-OCRv5_mobile_rec
```

下载后会缓存，后续不会重复下载。

---

## 浏览器出现 CORS 错误

检查：

```text
backend/.env
```

中的：

```env
ALLOWED_ORIGINS=...
```

修改后重新启动后端。

---

# 计划部署

前端仍计划使用：

```text
GitHub Pages
```

例如：

```text
https://NiceStone-Hill.github.io/inkecho/
```

GitHub Pages 使用子路径：

```text
/inkecho/
```

因此需要保持：

- `frontend/vite.config.js` 的生产 `base`
- `HashRouter`

配置一致。

后端部署需要支持：

- Python
- FastAPI
- PaddlePaddle
- PaddleOCR 模型缓存
- 必要的 CPU / 内存资源

因此部署平台需要在正式部署前实际验证 PaddleOCR 的运行环境，不应只按普通轻量 FastAPI 服务配置。

---

# 当前开发状态

目前已完成或正在集成：

- React + Vite 阅读前端
- FastAPI 后端
- 分阶段 Reading / Evidence 解锁
- Checkpoint 阅读提醒
- Checkpoint 30 秒自动消失通知
- Hypothesis V1 / V2 / V3
- Pressure Test Agent
- Deterministic Context Builder
- Evidence 边界控制
- Annotation 上下文接入
- 键盘批注
- 手写 Canvas
- 本地 PaddleOCR 手写识别
- OCR 结果用户确认 / 修改
- Annotation 原始 strokes 保存
- LLM 动态压力问题
- fallback 安全问题
- AI 状态调试接口
- 人工维护的最终谜底链
- 最终思考演化回放

---

# Known Limitations

当前原型仍有以下限制：

- 手写 OCR 主要面向短句、单行中文批注
- OCR 准确率受笔迹质量影响
- Annotation 后端存储目前仍偏原型化
- fallback 为固定 `UNCLEAR` 问题，不会根据关键词继续猜测
- 当前内容和 Prompt 针对受控推理阅读场景设计
- 尚未完成完整生产环境的持久化、并发与监控
- 正式部署前仍需要进行更多防剧透测试与用户测试

---

# 贡献说明

提交代码前请确保：

1. 前端能够正常启动
2. 后端能够正常启动
3. `/api/health` 正常返回
4. `/api/analyze` 能正常调用
5. `/api/ai/status` 能正确反映 fallback 状态
6. 手写 OCR 能加载 `PP-OCRv5_mobile_rec`
7. 没有提交 API Key 或 `.env`
8. 没有提交 `.venv`、`node_modules` 或构建产物
9. API 修改后同步更新 README
10. Agent 修改不得破坏 Evidence 边界或引入剧透

---

# License

当前项目暂未选择开源许可证。

在正式公开发布或接受外部贡献前，需要添加合适的 `LICENSE` 文件。
