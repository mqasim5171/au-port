from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from core.db import SessionLocal
from schemas.quality import QualityOut
from .auth import get_current_user
from services.quality_service import compute_quality_scores
from models.quality import QualityScore
from datetime import datetime
import uuid
import json

router = APIRouter(prefix="/courses", tags=["Quality"])

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

@router.get("/{course_id}/quality-score", response_model=QualityOut)
def get_quality_score(course_id: str, db: Session = Depends(get_db), current=Depends(get_current_user)):
    score = (
        db.query(QualityScore)
        .filter(QualityScore.course_id == course_id)
        .order_by(QualityScore.created_at.desc())
        .first()
    )
    if not score:
        raise HTTPException(status_code=404, detail="No quality score found for this course")

    suggestions = json.loads(score.suggestions) if score.suggestions else []

    return QualityOut(
        course_id=score.course_id,
        overall_score=score.overall_score,
        completeness_score=score.completeness_score,
        alignment_score=score.alignment_score,
        feedback_score=score.feedback_score,
        suggestions=suggestions
    )

@router.post("/{course_id}/recompute", response_model=QualityOut)
def recompute_quality(course_id: str, db: Session = Depends(get_db), current=Depends(get_current_user)):
    # Example CLOs, assessments, feedback
    clos = ["Understand software design", "Apply algorithms", "Communicate effectively"]
    assessments = ["final exam", "project", "oral presentation"]
    feedback = ["Excellent course", "Poor explanation", "Very good experience"]

    # Compute scores (returns dict)
    scores = compute_quality_scores(course_id, clos, assessments, feedback, db)

    # Save in DB
    new_score = QualityScore(
        id=str(uuid.uuid4()),
        course_id=course_id,
        overall_score=scores["overall_score"],
        completeness_score=scores["completeness_score"],
        alignment_score=scores["alignment_score"],
        feedback_score=scores["feedback_score"],
        suggestions=json.dumps(scores["suggestions"]),
        created_at=datetime.utcnow(),
        generated_at=datetime.utcnow()
    )

    db.add(new_score)
    db.commit()
    db.refresh(new_score)

    # Convert suggestions to list for Pydantic
    new_score.suggestions = scores["suggestions"]

    return QualityOut.from_orm(new_score)
