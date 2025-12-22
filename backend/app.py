# backend/app.py

from dotenv import load_dotenv
load_dotenv()
import os

print("OPENROUTER_API_KEY loaded:", bool(os.getenv("OPENROUTER_API_KEY")))

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from routers import completeness
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
# backend/app.py (only the include_router part)

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
app.include_router(completeness.router)
# ✅ IMPORTANT: DO NOT prefix these with "/api"
app.include_router(assessments.router)

# ✅ IMPORTANT: DO NOT prefix these with "/execution"
app.include_router(course_execution.router)
app.include_router(execution_zip.router)

# ✅ suggestions router currently has "/api" inside it — we'll fix the router file next
app.include_router(suggestions.router)

app.include_router(admin.router)
app.include_router(course_lead.router)
app.include_router(assessments.router, prefix="/api")

# (Optional backwards compatibility)
# app.include_router(course_execution.router)
# app.include_router(execution_zip.router)


@app.on_event("startup")
def _startup_schema():
    ensure_all_tables_once()
