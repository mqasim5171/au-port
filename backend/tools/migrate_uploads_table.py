import os
from pathlib import Path

from dotenv import load_dotenv
from sqlalchemy import create_engine, text

# ---- Load .env (backend/.env) ----
BASE_DIR = Path(__file__).resolve().parent.parent  # -> backend/
env_path = BASE_DIR / ".env"

# Force-load it and override any empty env
load_dotenv(dotenv_path=env_path, override=True)

DB_URL = os.getenv("DB_URL") or os.getenv("DATABASE_URL")

if not DB_URL:
    print("❌ Could not find DB_URL or DATABASE_URL in environment.")
    print(f"   Looked for .env at: {env_path} (exists={env_path.exists()})")
    # print a hint if env exists
    if env_path.exists():
        print("   ✅ .env exists, but it may not contain DB_URL= or DATABASE_URL=")
    raise RuntimeError("DB_URL is not set")

engine = create_engine(DB_URL, pool_pre_ping=True)

ALTERS = [
    """
    DO $$
    BEGIN
        IF NOT EXISTS (
            SELECT 1 FROM information_schema.columns
            WHERE table_name='uploads' AND column_name='uploader_id'
        ) THEN
            ALTER TABLE uploads ADD COLUMN uploader_id uuid;
        END IF;
    END $$;
    """
]

def main():
    with engine.begin() as conn:
        for stmt in ALTERS:
            conn.execute(text(stmt))
    print("✅ Migration done.")

if __name__ == "__main__":
    main()
