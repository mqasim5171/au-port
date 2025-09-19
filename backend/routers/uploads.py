# routers/upload.py
from fastapi import APIRouter, UploadFile, File, HTTPException, Depends
from typing import List, Dict, Any
from sqlalchemy.orm import Session
from core.db import SessionLocal
from models.uploads import Base, engine
from schemas.uploads import UploadItem, UploadResponse
from modules.upload_parser import handle_bytes

router = APIRouter(prefix="/upload", tags=["Upload & Parsing"])

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

# Create tables once (or use Alembic)
Base.metadata.create_all(bind=engine)

@router.post("", response_model=UploadResponse)
async def upload_files(course_id: str, files: List[UploadFile] = File(...), db: Session = Depends(get_db)):
    """
    Accepts PDFs/ZIP/DOCX. For ZIPs, extracts recursively and indexes inner files.
    Returns index (files) and a consolidated parse log.
    """
    if not course_id:
        raise HTTPException(status_code=400, detail="course_id is required")

    global_log: List[Dict[str, Any]] = []
    indexed_items: List[UploadItem] = []

    for f in files:
        data = await f.read()
        try:
            uploads = handle_bytes(db, course_id, f.filename, data, global_log)
            db.commit()
            for up in uploads:
                indexed_items.append(UploadItem(
                    id=str(up.id),
                    filename_original=up.filename_original,
                    filename_stored=up.filename_stored,
                    ext=up.ext,
                    file_type_guess=up.file_type_guess,
                    week_no=up.week_no,
                    bytes=up.bytes,
                    pages=up.pages,
                    version=up.version
                ))
        except Exception as e:
            db.rollback()
            global_log.append({"level":"ERROR","code":"INDEX_FAIL","message":str(e), "file":f.filename})

    return UploadResponse(files=indexed_items, log=global_log)
