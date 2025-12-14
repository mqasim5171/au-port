# backend/core/schema_guard.py
from sqlalchemy.exc import OperationalError
from sqlalchemy import inspect
from core.db import engine
from core.base import Base

import models.suggestion
from models import user, course, file_upload, feedback, course_execution  # noqa

_initialized = False

def ensure_all_tables_once():
    global _initialized
    if _initialized:
        return

    try:
        Base.metadata.create_all(bind=engine)  # creates only missing tables
        _initialized = True
    except OperationalError as e:
        # DB not reachable (DNS / network / SG), don't kill the server in dev
        print("⚠️ Database not reachable, skipping schema creation.")
        print(e)
