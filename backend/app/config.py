"""App configuration, loaded from environment variables."""

from __future__ import annotations

from functools import lru_cache
from pathlib import Path

from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict

# config.py lives at backend/app/config.py, so the project root is two parents up.
_PROJECT_ROOT = Path(__file__).resolve().parent.parent.parent
_BACKEND_ROOT = Path(__file__).resolve().parent.parent


class Settings(BaseSettings):
    # Look for .env at the project root first (where .env.example lives),
    # then in the backend folder. Later files in the tuple win.
    # env_ignore_empty makes an empty shell env var fall through to the file
    # value, which matters when a parent process exports the key as "".
    model_config = SettingsConfigDict(
        env_file=(_PROJECT_ROOT / ".env", _BACKEND_ROOT / ".env"),
        env_file_encoding="utf-8",
        case_sensitive=False,
        extra="ignore",
        env_ignore_empty=True,
    )

    anthropic_api_key: str = Field(default="", description="Anthropic API key.")
    anthropic_model: str = Field(
        default="claude-haiku-4-5-20251001",
        description="Model used by the agent. Haiku is plenty for tool selection.",
    )

    database_url: str = Field(
        default="sqlite:///./tigtagtoe.db",
        description="SQLAlchemy database URL.",
    )

    cors_origins: str = Field(
        default="http://localhost:5173,https://tigtagtoe.vercel.app",
        description="Comma-separated list of allowed origins (local Vite + production Vercel).",
    )

    max_emails_per_run: int = Field(default=300)
    agent_concurrency: int = Field(default=5)
    max_body_chars: int = Field(default=4000)

    @property
    def cors_origin_list(self) -> list[str]:
        return [o.strip() for o in self.cors_origins.split(",") if o.strip()]


@lru_cache
def get_settings() -> Settings:
    return Settings()
