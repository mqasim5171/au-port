# app.py
from fastapi import FastAPI
from routers import upload

app = FastAPI(title="Air QA Backend")
app.include_router(upload.router)

@app.get("/healthz")
def health():
    return {"ok": True}
