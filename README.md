# AI 对话机器人（FastAPI + DeepSeek）

一个前后端分离的 AI 对话机器人项目：

- **前端**：原生 HTML + CSS + JavaScript，使用 axios 对接后端，支持流式输出、Markdown 渲染、明暗主题切换。
- **后端**：使用 `uv` 管理 Python 项目，基于 FastAPI，对接 DeepSeek 大模型。

## 项目结构

```
.
├── backend/                 # 后端（uv + FastAPI）
│   ├── pyproject.toml       # 项目依赖（uv 管理）
│   ├── .env                 # DeepSeek 配置（含 API Key，勿提交）
│   ├── .env.example         # 配置模板
│   └── app/
│       ├── main.py          # FastAPI 入口 + 接口 + 托管前端
│       ├── config.py        # 读取 .env 配置
│       ├── schemas.py       # 请求数据模型
│       └── deepseek.py      # DeepSeek 客户端（流式 / 非流式）
└── frontend/                # 前端（原生 HTML/CSS/JS）
    ├── index.html
    ├── css/style.css
    └── js/
        ├── app.js           # 核心逻辑（axios 对接）
        └── lib/             # axios.js、marked.js（已本地化）
```

## 快速开始

### 1. 配置 DeepSeek

编辑 `backend/.env`，填入你的 API Key（已预填示例）。若使用官方 DeepSeek API，模型可改为：

```ini
DEEPSEEK_MODEL=deepseek-chat      # 通用对话
# 或
DEEPSEEK_MODEL=deepseek-reasoner  # 深度推理
```

### 2. 安装依赖（uv）

```bash
cd backend
uv sync
```

### 3. 启动后端

```bash
uv run uvicorn app.main:app --reload --port 8000
```

### 4. 打开前端

浏览器访问 **http://localhost:8000**（后端已自动托管前端静态文件）。

> 也可以直接用浏览器打开 `frontend/index.html`（file:// 协议），前端会自动把接口指向 `http://localhost:8000`。

## 接口说明

| 方法 | 路径 | 说明 |
| --- | --- | --- |
| GET | `/api/health` | 健康检查 |
| POST | `/api/chat` | 非流式对话，返回 `{"reply": "..."}` |
| POST | `/api/chat/stream` | 流式对话（SSE），逐段返回 `{"delta": "..."}` 与 `{"done": true}` |

请求体示例：

```json
{
  "messages": [
    { "role": "user", "content": "你好" }
  ]
}
```

## 说明

- 前端默认走**流式接口**，失败时自动降级为非流式接口。
- API Key 存放在 `backend/.env`，已被 `.gitignore` 忽略，请勿提交到版本库。
