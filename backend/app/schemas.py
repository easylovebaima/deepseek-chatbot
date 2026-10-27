"""请求 / 响应数据模型。"""
from pydantic import BaseModel, Field


class Message(BaseModel):
    role: str = Field(..., description="角色：system / user / assistant")
    content: str = Field(..., description="消息内容")


class ChatRequest(BaseModel):
    messages: list[Message] = Field(..., description="对话历史（不含 system）")
