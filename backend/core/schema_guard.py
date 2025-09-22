# backend/core/schema_guard.py
from sqlalchemy import inspect
from core.db import engine
from core.base import Base

# import all models so they register on Base.metadata
# add your modules here
from models import user, course, file_upload, feedback  # noqa

_initialized = False

def ensure_all_tables_once():
    global _initialized
    if _initialized:
        return
    # creates only missing tables
    Base.metadata.create_all(bind=engine)
    _initialized = True
