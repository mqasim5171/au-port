from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from routers import auth, users, courses, uploads, feedback, quality, health, dashboard
from core.schema_guard import ensure_all_tables_once

app = FastAPI(title="Air QA Backend")

# IMPORTANT: with allow_credentials=True, you CANNOT use "*" for origins.
ALLOWED_ORIGINS = ["http://localhost:3000", "http://127.0.0.1:3000"]

app.add_middleware(
    CORSMiddleware,
    allow_origins=ALLOWED_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Routers
app.include_router(auth.router)
app.include_router(users.router)
app.include_router(courses.router)
app.include_router(uploads.router)
app.include_router(feedback.router)
app.include_router(quality.router)
app.include_router(health.router)
app.include_router(dashboard.router)

@app.on_event("startup")
def _startup_schema():
    ensure_all_tables_once()
