from pydantic import BaseModel, Field
import os

class Settings(BaseModel):
    DATABASE_URL: str = Field(..., description="SQLAlchemy URL")
    SECRET_KEY: str = Field(..., min_length=32)
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 60
    REFRESH_TOKEN_EXPIRE_DAYS: int = 7
    APP_ENV: str = "dev"

    @classmethod
    def load(cls) -> "Settings":
        return cls(
            DATABASE_URL=os.getenv("DATABASE_URL", ""),
            SECRET_KEY=os.getenv("SECRET_KEY", "CHANGE_THIS_SUPER_LONG_SECRET"),
            ACCESS_TOKEN_EXPIRE_MINUTES=int(os.getenv("ACCESS_TOKEN_EXPIRE_MINUTES", "60")),
            REFRESH_TOKEN_EXPIRE_DAYS=int(os.getenv("REFRESH_TOKEN_EXPIRE_DAYS", "7")),
            APP_ENV=os.getenv("APP_ENV", "dev"),
        )

settings = Settings.load()
