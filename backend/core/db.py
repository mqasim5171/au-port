# backend/core/db.py
import os
from pathlib import Path
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

# --- Load .env from the backend directory (this file lives in backend/core/) ---
try:
    from dotenv import load_dotenv
    BACKEND_DIR = Path(__file__).resolve().parent.parent  # .../backend
    load_dotenv(BACKEND_DIR / ".env")
except Exception:
    # dotenv is optional during tests, but for dev you should install it
    pass

DB_URL = os.getenv("DATABASE_URL")

if not DB_URL:
    raise RuntimeError(
        "DATABASE_URL is not set. Ensure backend/.env exists and launch with the project's venv."
    )

connect_args = {}
if DB_URL.startswith("postgresql+"):
    # RDS public instance → enforce SSL
    connect_args["sslmode"] = "require"

engine = create_engine(
    DB_URL,
    pool_pre_ping=True,
    future=True,
    connect_args=connect_args,
)

print("DB_URL:", DB_URL)


SessionLocal = sessionmaker(bind=engine, autoflush=False, autocommit=False, future=True)
