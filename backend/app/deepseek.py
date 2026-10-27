"""DeepSeek 大模型客户端（OpenAI 兼容协议）。"""
import json

import httpx

from .config import settings


def _headers() -> dict:
    return {
        "Authorization": f"Bearer {settings.deepseek_api_key}",
        "Content-Type": "application/json",
    }


def _url() -> str:
    return settings.deepseek_base_url.rstrip("/") + "/chat/completions"


def _payload(messages: list[dict], stream: bool) -> dict:
    return {
        "model": settings.deepseek_model,
        "messages": messages,
        "stream": stream,
        "temperature": settings.deepseek_temperature,
        "max_tokens": settings.deepseek_max_tokens,
    }


async def chat_complete(messages: list[dict]) -> str:
    """非流式：一次性返回完整回答。"""
    timeout = httpx.Timeout(connect=10.0, read=120.0, write=30.0, pool=10.0)
    async with httpx.AsyncClient(timeout=timeout) as client:
        resp = await client.post(_url(), json=_payload(messages, stream=False), headers=_headers())
        resp.raise_for_status()
        data = resp.json()
        try:
            return data["choices"][0]["message"]["content"]
        except (KeyError, IndexError, TypeError) as exc:
            raise RuntimeError(f"DeepSeek 返回格式异常：{data}") from exc


async def chat_stream(messages: list[dict]):
    """流式：逐段产出回答文本（async generator）。"""
    timeout = httpx.Timeout(connect=10.0, read=300.0, write=30.0, pool=10.0)
    async with httpx.AsyncClient(timeout=timeout) as client:
        async with client.stream("POST", _url(), json=_payload(messages, stream=True), headers=_headers()) as resp:
            resp.raise_for_status()
            async for line in resp.aiter_lines():
                line = line.strip()
                if not line or not line.startswith("data:"):
                    continue
                data = line[5:].strip()
                if data == "[DONE]":
                    break
                try:
                    chunk = json.loads(data)
                except json.JSONDecodeError:
                    continue
                choices = chunk.get("choices") or []
                if not choices:
                    continue
                delta = (choices[0].get("delta") or {}).get("content")
                if delta:
                    yield delta
