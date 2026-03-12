from pydantic_settings import BaseSettings, SettingsConfigDict
from pathlib import Path


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore",
    )

    # App
    APP_NAME: str = "FinSight AI"
    DEBUG: bool = True

    # Gemini
    GOOGLE_API_KEY: str
    GEMINI_MODEL: str = "gemini-2.5-flash-preview-04-17"

    # Embeddings
    EMBEDDING_PROVIDER: str = "huggingface"

    # Optional tool API keys
    TAVILY_API_KEY: str = ""
    ALPHA_VANTAGE_KEY: str = ""

    # Auth (Phase 2)
    SECRET_KEY: str = "change-this-secret-key"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 60

    # Storage
    CHROMA_DB_PATH: str = "./data/chroma"
    UPLOAD_DIR: str = "./data/uploads"
    DATABASE_URL: str = "sqlite+aiosqlite:///./data/finsight.db"

    def get_upload_path(self) -> Path:
        path = Path(self.UPLOAD_DIR)
        path.mkdir(parents=True, exist_ok=True)
        return path

    def get_chroma_path(self) -> str:
        Path(self.CHROMA_DB_PATH).mkdir(parents=True, exist_ok=True)
        return self.CHROMA_DB_PATH


settings = Settings()