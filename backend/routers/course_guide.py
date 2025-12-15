from fastapi import APIRouter, UploadFile, File, Depends
from sqlalchemy.orm import Session

from core.db import get_db
from models.uploads import Upload
from services.upload_adapter import parse_document

import uuid

router = APIRouter(prefix="/courses", tags=["Course Guide"])

@router.post("/{course_id}/course-guide")
async def upload_course_guide(
    course_id: str,
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    current_user=Depends(...)
):
    upload = Upload(
        id=str(uuid.uuid4()),
        course_id=course_id,
        uploader_id=current_user.id,
        category="course_guide",
        folder_key="course_guide",
        file_name=file.filename,
        file_path=f"storage/{course_id}/course_guide/{file.filename}"
    )

    db.add(upload)
    db.commit()
    db.refresh(upload)

    # Extract text for CLO / week parsing
    parse_document(upload)

    return {"message": "Course guide uploaded successfully"}
