"""应用配置：从 .env 读取 DeepSeek 等参数。"""
from pathlib import Path

from pydantic_settings import BaseSettings, SettingsConfigDict

# backend/ 目录
BASE_DIR = Path(__file__).resolve().parent.parent


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=str(BASE_DIR / ".env"),
        env_file_encoding="utf-8",
        extra="ignore",
    )

    # DeepSeek
    deepseek_api_key: str = ""
    deepseek_base_url: str = "https://api.deepseek.com/v1"
    deepseek_model: str = "deepseek-v4-pro"
    deepseek_temperature: float = 0.7
    deepseek_max_tokens: int = 2048

    # 系统提示词
    system_prompt: str = "你是一位乐于助人、专业友善的中文 AI 助手。请用简洁清晰的语言回答问题。"


settings = Settings()
