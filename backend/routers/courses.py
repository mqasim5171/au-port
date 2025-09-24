from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, status
from sqlalchemy.orm import Session
from pathlib import Path
from uuid import uuid4
from datetime import datetime, timezone

from core.db import SessionLocal
from .auth import get_current_user
from models.course import Course
from models.file_upload import FileUpload
from schemas.course import CourseCreate, CourseOut

router = APIRouter(prefix="/courses", tags=["Courses"])

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

async def _save_course_upload(course_id: str, file: UploadFile, db: Session, current):
    course = db.get(Course, course_id)
    if not course:
        raise HTTPException(status_code=404, detail="Course not found")

    base_dir = Path("storage") / "course_uploads" / course_id
    base_dir.mkdir(parents=True, exist_ok=True)

    ts = datetime.now(timezone.utc).strftime("%Y%m%dT%H%M%SZ")
    dest = base_dir / f"{ts}_{file.filename}"

    total_bytes = 0
    with dest.open("wb") as f:
        while chunk := await file.read(1024 * 1024):
            total_bytes += len(chunk)
            f.write(chunk)

    rec = FileUpload(
        id=str(uuid4()),
        course_id=course_id,
        user_id=current.id,
        filename=file.filename,
        file_type=file.content_type,
        file_size=total_bytes,
        upload_date=datetime.now(timezone.utc),
        validation_status="pending",
        validation_details="Not validated yet",
    )

    db.add(rec)
    db.commit()
    db.refresh(rec)

    return {
        "id": rec.id,
        "filename": rec.filename,
        "upload_date": rec.upload_date,
        "validation_status": rec.validation_status,
    }

@router.get("", response_model=list[CourseOut])
@router.get("/", response_model=list[CourseOut])
def list_courses(db: Session = Depends(get_db), current=Depends(get_current_user)):
    return db.query(Course).order_by(Course.created_at.desc()).limit(200).all()

@router.post("", response_model=CourseOut, status_code=status.HTTP_201_CREATED)
@router.post("/", response_model=CourseOut, status_code=status.HTTP_201_CREATED)
def create_course(payload: CourseCreate, db: Session = Depends(get_db), current=Depends(get_current_user)):
    c = Course(**payload.model_dump())
    db.add(c); db.commit(); db.refresh(c)
    return c

@router.get("/{course_id}", response_model=CourseOut)
def get_course(course_id: str, db: Session = Depends(get_db), current=Depends(get_current_user)):
    c = db.get(Course, course_id)
    if not c:
        raise HTTPException(status_code=404, detail="Course not found")
    return c

@router.get("/{course_id}/uploads")
def list_course_uploads(course_id: str, db: Session = Depends(get_db), current=Depends(get_current_user)):
    if not db.get(Course, course_id):
        raise HTTPException(status_code=404, detail="Course not found")

    uploads = (
        db.query(FileUpload)
          .filter(FileUpload.course_id == course_id)
          .order_by(FileUpload.upload_date.desc())
          .all()
    )
    return [
        {
            "id": u.id,
            "filename": u.filename,
            "upload_date": u.upload_date,
            "validation_status": u.validation_status,
        }
        for u in uploads
    ]

@router.post("/{course_id}/upload")
async def upload_course_file(course_id: str, file: UploadFile = File(...), db: Session = Depends(get_db), current=Depends(get_current_user)):
    return await _save_course_upload(course_id, file, db, current)
