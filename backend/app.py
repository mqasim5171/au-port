# app.py
import os

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

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
)

app = FastAPI(title="Air QA Backend")

# -------------------- CORS --------------------
FRONTEND_URL = os.getenv("FRONTEND_URL", "").strip()  # optional (Netlify)

ALLOWED_ORIGINS = [
    "http://localhost:3000",
    "http://127.0.0.1:3000",
    "http://localhost:3001",   # ✅ your CRA dev server
    "http://127.0.0.1:3001",
]

if FRONTEND_URL:
    ALLOWED_ORIGINS.append(FRONTEND_URL)

app.add_middleware(
    CORSMiddleware,
    allow_origins=ALLOWED_ORIGINS,
    allow_credentials=False,     # ✅ JWT via Authorization header (no cookies)
    allow_methods=["*"],
    allow_headers=["*"],         # ✅ includes Authorization
)
# ----------------------------------------------

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
app.include_router(course_execution.router)
app.include_router(assessment_router.router)
app.include_router(student_router.router)
app.include_router(grading_audit_router.router)
app.include_router(suggestions.router)
# ----------------------------------------------


@app.on_event("startup")
def _startup_schema():
    ensure_all_tables_once()


@app.get("/")
def root():
    return {"status": "ok", "service": "air-qa-backend"}