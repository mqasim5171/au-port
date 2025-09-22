from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from core.db import SessionLocal
from schemas.quality import QualityOut
from .auth import get_current_user

router = APIRouter(prefix="/quality", tags=["Quality"])

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

@router.get("/{course_id}", response_model=QualityOut)
def get_quality_score(course_id: str, db: Session = Depends(get_db), current=Depends(get_current_user)):
    # TODO: port your scoring logic; this is a placeholder
    return QualityOut(
        course_id=course_id,
        overall_score=0.82,
        completeness_score=0.85,
        alignment_score=0.78,
        feedback_score=0.84,
        suggestions='["Add missing lesson plans", "Clarify CLO wording"]',
    )
