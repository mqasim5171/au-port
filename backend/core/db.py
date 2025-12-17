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


def init_db():
    """
    Import ALL models here so SQLAlchemy knows about them
    before creating tables.
    """

    # NOTE:
    # SQLAlchemy only creates tables for models that are imported at least once.
    # Keep ALL model imports here (even if some routers/services are not used yet)
    # so your DB always has the full schema and you don't get "table does not exist".

    # --- Core auth / org ---
    import models.user
    import models.course
    import models.course_assignment

    # --- Uploads / storage ---
    import models.uploads
    import models.material

    # --- Course CLOs / alignment ---
    import models.course_clo
    import models.clo_alignment

    # --- Course execution monitor (weekly plan/execution/deviations) ---
    import models.course_execution

    # --- Assessments + question mapping ---
    import models.assessment
    import models.assessment_question
    import models.question_clo

    # --- Student submissions / grading ---
    import models.student_submission
    import models.submission_question_score
    import models.grading_audit
    import models.student

    # --- Feedback / quality / suggestions ---
    import models.feedback
    import models.student_feedback
    import models.quality
    import models.suggestion

    Base.metadata.create_all(bind=engine)
