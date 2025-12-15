from fastapi import APIRouter, UploadFile, File, Depends, Query
from sqlalchemy.orm import Session
import uuid

from core.db import get_db
from models.uploads import Upload

router = APIRouter(prefix="/courses", tags=["Lectures"])

@router.post("/{course_id}/lectures")
async def upload_lecture(
    course_id: str,
    week: int = Query(..., ge=1, le=16),
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    current_user=Depends(...)
):
    upload = Upload(
        id=str(uuid.uuid4()),
        course_id=course_id,
        uploader_id=current_user.id,
        category="lecture",
        folder_key=f"lectures/week-{week:02d}",
        file_name=file.filename,
        file_path=f"storage/{course_id}/lectures/week-{week:02d}/{file.filename}"
    )

    db.add(upload)
    db.commit()

    return {"message": f"Lecture for week {week} uploaded"}
