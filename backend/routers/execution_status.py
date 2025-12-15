from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from core.db import get_db
from models.uploads import Upload
from services.execution_monitor import compute_execution_status

router = APIRouter(prefix="/courses", tags=["Execution Monitor"])

@router.get("/{course_id}/execution-status")
def get_execution_status(course_id: str, db: Session = Depends(get_db)):
    lectures = db.query(Upload).filter(
        Upload.course_id == course_id,
        Upload.category == "lecture"
    ).all()

    # For now assume 16 weeks (later parse from guide)
    status = compute_execution_status(16, lectures)

    return status
