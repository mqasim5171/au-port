# backend/app.py
import os

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from core.schema_guard import ensure_all_tables_once
from routers import assessments
from routers import (
    auth,
    admin,
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
    
    student_router,
    grading_audit_router,
    suggestions,
    course_lead,
    execution_zip,
)

app = FastAPI(title="Air QA Backend")

# --- CORS CONFIG ------------------------------------------------------------
FRONTEND_URL = os.getenv("FRONTEND_URL", "").strip()

ALLOWED_ORIGINS = [
    "http://localhost:3000",
    "http://127.0.0.1:3000",
]
if FRONTEND_URL:
    ALLOWED_ORIGINS.append(FRONTEND_URL)

app.add_middleware(
    CORSMiddleware,
    allow_origins=ALLOWED_ORIGINS,
    allow_origin_regex=r"https://.*\.netlify\.app",
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
# ---------------------------------------------------------------------------

# Base Routers
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

app.include_router(student_router.router)
app.include_router(grading_audit_router.router)
app.include_router(suggestions.router)
app.include_router(admin.router)
app.include_router(course_lead.router)
app.include_router(assessments.router, prefix="/api") 
# ✅ IMPORTANT: expose execution endpoints under /execution
# This makes your frontend URL work:
#   /execution/courses/{courseId}/weeks/{weekNo}/weekly-zip
app.include_router(course_execution.router, prefix="/execution")
app.include_router(execution_zip.router, prefix="/execution")

# (Optional backwards compatibility)
# app.include_router(course_execution.router)
# app.include_router(execution_zip.router)


@app.on_event("startup")
def _startup_schema():
    ensure_all_tables_once()
