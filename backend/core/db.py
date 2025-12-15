# backend/core/db.py
import os
from pathlib import Path
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker, declarative_base

# --- Load .env from the backend directory ---
try:
    from dotenv import load_dotenv
    BACKEND_DIR = Path(__file__).resolve().parent.parent
    load_dotenv(BACKEND_DIR / ".env")
except Exception:
    pass

DB_URL = os.getenv("DATABASE_URL")

if not DB_URL:
    raise RuntimeError(
        "DATABASE_URL is not set. Ensure backend/.env exists and launch with the project's venv."
    )

connect_args = {}
if DB_URL.startswith("postgresql+"):
    connect_args["sslmode"] = "require"

engine = create_engine(
    DB_URL,
    pool_pre_ping=True,
    future=True,
    connect_args=connect_args,
)

print("DB_URL:", DB_URL)

SessionLocal = sessionmaker(
    bind=engine,
    autoflush=False,
    autocommit=False,
    future=True
)

Base = declarative_base()


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


# ✅ ADD THIS FUNCTION (VERY IMPORTANT)
def init_db():
    """
    Import ALL models here so SQLAlchemy knows about them
    before creating tables.
    """

    # --- existing models ---
    import models.user
    import models.course
    import models.uploads
    import models.course_clo
    import models.assessment
    import models.student_submission
    import models.clo_alignment

    # --- NEW workflow models ---
    import models.assessment_question
    import models.question_clo
    # import models.submission_question_score  # uncomment if you added it

    Base.metadata.create_all(bind=engine)
