# app.py
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
import os

from routers import (
    auth, users, courses, uploads, feedback, quality, health, dashboard,
    clo_alignment, course_clo, student_feedback ,course_execution
)
from core.schema_guard import ensure_all_tables_once

app = FastAPI(title="Air QA Backend")

# --- CORS CONFIG ------------------------------------------------------------
# NOTE: With allow_credentials=True you must NOT use "*" for origins.
# We read your Netlify origin from FRONTEND_URL and also allow local dev.
FRONTEND_URL = os.getenv("FRONTEND_URL", "").strip()  # e.g. https://air-qa.netlify.app

ALLOWED_ORIGINS = [
    "http://localhost:3000",
    "http://127.0.0.1:3000",
]
if FRONTEND_URL:
    ALLOWED_ORIGINS.append(FRONTEND_URL)

app.add_middleware(
    CORSMiddleware,
    allow_origins=ALLOWED_ORIGINS,
    # If you also want to allow Netlify preview URLs, keep this regex:
    allow_origin_regex=r"https://.*\.netlify\.app",
    allow_credentials=True,           # matches axios withCredentials: true
    allow_methods=["*"],
    allow_headers=["*"],              # includes Authorization header
)
# ---------------------------------------------------------------------------

# Routers
app.include_router(auth.router)
app.include_router(users.router)
app.include_router(courses.router)
app.include_router(uploads.router)
app.include_router(feedback.router)
app.include_router(quality.router)
app.include_router(course_clo.router)
app.include_router(clo_alignment.router)
app.include_router(health.router)
app.include_router(dashboard.router)
app.include_router(student_feedback.router)
app.include_router(course_execution.router)

@app.on_event("startup")
def _startup_schema():
    ensure_all_tables_once()
