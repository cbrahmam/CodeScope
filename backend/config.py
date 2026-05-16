import os

class Settings:
    DATABASE_PATH: str = os.path.join(os.path.dirname(__file__), "review_data", "codescope.db")
    CORS_ORIGINS: list = ["http://localhost:5173"]
    API_PREFIX: str = "/api"
    MAX_FILE_SIZE: int = 500 * 1024
    MAX_FILES_PER_REVIEW: int = 10

settings = Settings()
