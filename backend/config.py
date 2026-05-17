import os
from pathlib import Path
from dotenv import load_dotenv

load_dotenv(Path(__file__).resolve().parent.parent / ".env")


class Settings:
    DATABASE_PATH: str = os.path.join(os.path.dirname(__file__), "review_data", "codescope.db")
    CORS_ORIGINS: list = ["http://localhost:5173"]
    API_PREFIX: str = "/api"
    MAX_FILE_SIZE: int = 500 * 1024
    MAX_FILES_PER_REVIEW: int = 10
    ANTHROPIC_API_KEY: str = os.getenv("ANTHROPIC_API_KEY", "")
    GITHUB_TOKEN: str = os.getenv("GITHUB_TOKEN", "")

settings = Settings()
