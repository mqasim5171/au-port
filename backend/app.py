# backend/app.py
import os
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from core.db import init_db
from core.schema_guard import ensure_all_tables_once

from routers import (
    auth,
    users,
    courses,
    uploads,
    feedback,
    quality,
    health,
    dashboard,
    clo_alignment,
    course_clo,
    student_feedback,
    course_execution,
    assessment_router,
    student_router,
    grading_audit_router,
    suggestions,
    course_guide,
    lectures,
    assessment_questions,
    analysis,
    execution_status,
)

app = FastAPI(title="Air QA Backend")

# ✅ Initialize DB
init_db()

# ✅ CORS — MUST be added before heavy routing issues show up in browser
FRONTEND_URL = os.getenv("FRONTEND_URL", "").strip()

ALLOWED_ORIGINS = [
    "http://localhost:3000",
    "http://127.0.0.1:3000",
    "http://localhost:3001",
    "http://127.0.0.1:3001",
]

if FRONTEND_URL:
    ALLOWED_ORIGINS.append(FRONTEND_URL)

app.add_middleware(
    CORSMiddleware,
    allow_origins=ALLOWED_ORIGINS,
    allow_credentials=True,        # ✅ safe for tokens too
    allow_methods=["*"],
    allow_headers=["*"],
)

# -------------------- Routers -----------------
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

# Course execution
app.include_router(course_execution.router)
app.include_router(execution_status.router)

# Assessments
app.include_router(assessment_router.router)
app.include_router(assessment_questions.router)
app.include_router(grading_audit_router.router)

# Course guide + lectures
app.include_router(course_guide.router)
app.include_router(lectures.router)

# Students + suggestions
app.include_router(student_router.router)
app.include_router(suggestions.router)

# Analysis
app.include_router(analysis.router)
# ----------------------------------------------


@app.on_event("startup")
def _startup_schema():
    ensure_all_tables_once()


@app.get("/")
def root():
    return {"status": "ok", "service": "air-qa-backend"}
