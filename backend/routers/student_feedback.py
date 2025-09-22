from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session
from typing import List, Dict, Any
from core.db import get_db
from models.student_feedback import StudentFeedback

router = APIRouter(prefix="/feedback", tags=["Feedback"])

# 1. Get list of batches
@router.get("/batches")
def get_batches(db: Session = Depends(get_db)) -> List[int]:
    results = db.query(StudentFeedback.batch).distinct().all()
    return [r[0] for r in results if r[0] is not None]

# 2. Get feedback summary by batch (with filters)
@router.get("/")
def get_feedback(
    batch: int = Query(...),
    course: str | None = None,
    instructor: str | None = None,
    db: Session = Depends(get_db)
) -> Dict[str, Any]:
    q = db.query(StudentFeedback).filter(StudentFeedback.batch == batch)

    if course:
        q = q.filter(StudentFeedback.course_name == course)
    if instructor:
        q = q.filter(StudentFeedback.instructor_name == instructor)

    rows = q.all()

    sentiment_counts = {"pos": 0, "neu": 0, "neg": 0}
    course_summary = {}
    themes = set()

    for r in rows:
        sent = (r.sentiment or "").lower()
        if sent.startswith("pos"):
            sentiment_counts["pos"] += 1
        elif sent.startswith("neg"):
            sentiment_counts["neg"] += 1
        else:
            sentiment_counts["neu"] += 1

        if r.course_name not in course_summary:
            course_summary[r.course_name] = {"pos": 0, "neu": 0, "neg": 0}
        course_summary[r.course_name][sent[:3]] += 1

        if r.topic is not None:
            themes.add(f"Topic{r.topic}")

    return {
        "sentiment": sentiment_counts,
        "courses": [{"course": c, **counts} for c, counts in course_summary.items()],
        "themes": list(themes)[:10]  # top 10 only
    }
