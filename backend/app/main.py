"""FastAPI 应用入口：对话接口 + 托管前端静态文件。"""
import json
import logging
from contextlib import asynccontextmanager

import httpx
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
from fastapi.staticfiles import StaticFiles

from .config import BASE_DIR, settings
from .deepseek import chat_complete, chat_stream
from .schemas import ChatRequest

logger = logging.getLogger("uvicorn.error")


@asynccontextmanager
async def lifespan(app: FastAPI):
    if not settings.deepseek_api_key:
        logger.warning("未检测到 DEEPSEEK_API_KEY，请在 backend/.env 中配置！")
    else:
        logger.info("DeepSeek 已就绪，模型：%s", settings.deepseek_model)
    yield


app = FastAPI(
    title="AI 对话机器人",
    description="FastAPI + DeepSeek 的 AI 聊天机器人",
    version="1.0.0",
    lifespan=lifespan,
)

# 允许跨域（前后端分离调试时使用）
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/api/health")
async def health():
    return {"status": "ok", "model": settings.deepseek_model}


def _build_messages(messages) -> list[dict]:
    msgs = [{"role": "system", "content": settings.system_prompt}]
    msgs += [{"role": m.role, "content": m.content} for m in messages]
    return msgs


@app.post("/api/chat")
async def chat(req: ChatRequest):
    """非流式接口：返回完整回答 JSON。"""
    try:
        reply = await chat_complete(_build_messages(req.messages))
    except httpx.HTTPStatusError as exc:
        raise HTTPException(
            status_code=502,
            detail=f"DeepSeek 上游错误：{exc.response.status_code} {exc.response.text[:200]}",
        )
    except Exception as exc:  # noqa: BLE001
        raise HTTPException(status_code=500, detail=str(exc))
    return {"reply": reply}


@app.post("/api/chat/stream")
async def chat_stream_endpoint(req: ChatRequest):
    """流式接口：以 SSE 逐段返回回答。"""

    async def gen():
        try:
            async for delta in chat_stream(_build_messages(req.messages)):
                yield f"data: {json.dumps({'delta': delta}, ensure_ascii=False)}\n\n"
            yield f"data: {json.dumps({'done': True}, ensure_ascii=False)}\n\n"
        except Exception as exc:  # noqa: BLE001
            logger.exception("流式对话失败")
            yield f"data: {json.dumps({'error': str(exc)}, ensure_ascii=False)}\n\n"

    return StreamingResponse(
        gen(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "X-Accel-Buffering": "no",
            "Connection": "keep-alive",
        },
    )


# 托管前端静态文件（前端位于 ../frontend）
FRONTEND_DIR = BASE_DIR.parent / "frontend"
if FRONTEND_DIR.exists():
    app.mount("/", StaticFiles(directory=str(FRONTEND_DIR), html=True), name="frontend")
