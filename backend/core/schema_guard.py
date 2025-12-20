# backend/core/schema_guard.py
from sqlalchemy.exc import OperationalError
from core.db import engine
from core.base import Base

# ✅ import models so metadata knows them
from models import user, course, uploads, course_execution  # noqa: F401
from models import assessment, student, student_submission  # noqa: F401

_initialized = False


def ensure_all_tables_once():
    global _initialized
    if _initialized:
        return

    try:
        Base.metadata.create_all(bind=engine)  # creates only missing tables
        _initialized = True
    except OperationalError as e:
        print("⚠️ Database not reachable, skipping schema creation.")
        print(e)
