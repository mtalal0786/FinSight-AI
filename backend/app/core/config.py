from pydantic_settings import BaseSettings, SettingsConfigDict
from pathlib import Path
import os

# Debug prints to see exactly what path we're trying
BASE_DIR = Path(__file__).resolve().parent.parent.parent  # → backend/
ENV_PATH = BASE_DIR / ".env"

print(f"[CONFIG DEBUG] Current file: {__file__}")
print(f"[CONFIG DEBUG] Calculated .env path: {ENV_PATH}")
print(f"[CONFIG DEBUG] File really exists? {ENV_PATH.is_file()}")
print(f"[CONFIG DEBUG] os.getcwd() = {os.getcwd()}")

class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=str(ENV_PATH),
        env_file_encoding="utf-8",
        extra="ignore",
    )

    # Make GEMINI_API_KEY optional temporarily to avoid crash while debugging
    GEMINI_API_KEY: str = ""
    GEMINI_MODEL: str = "gemini-2.5-flash"

    EMBEDDING_PROVIDER: str = "huggingface"
    HF_TOKEN: str = ""

    TAVILY_API_KEY: str = ""
    ALPHA_VANTAGE_KEY: str = ""

    GOOGLE_CSE_ID: str = ""
    GOOGLE_CSE_KEY: str = ""

    MAIL_USERNAME: str = ""
    MAIL_PASSWORD: str = ""
    MAIL_FROM: str = ""
    MAIL_FROM_NAME: str = ""
    MAIL_SERVER: str = ""
    MAIL_PORT: int = 587
    FRONTEND_URL: str = ""

    SECRET_KEY: str = "change-this-secret-key"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 60

    APP_NAME: str = "FinSight AI"
    DEBUG: bool = True

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

# Final check after pydantic loaded it
print("[CONFIG FINAL CHECK]")
print(f"  GEMINI_API_KEY length: {len(settings.GEMINI_API_KEY)}")
print(f"  ALPHA_VANTAGE_KEY: {settings.ALPHA_VANTAGE_KEY or 'None'}")
print(f"  TAVILY_API_KEY: {settings.TAVILY_API_KEY or 'None'}")