# routers/assessment_questions.py
from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from core.db import get_db
from models.assessment_question import AssessmentQuestion
from models.question_clo import QuestionCLO
from schemas.assessment_question import AssessmentQuestionCreate, QuestionCLOMap

router = APIRouter(prefix="/assessments", tags=["Assessment Questions"])

@router.post("/{assessment_id}/questions")
def add_question(assessment_id: str, data: AssessmentQuestionCreate, db: Session = Depends(get_db)):
    q = AssessmentQuestion(
        assessment_id=assessment_id,
        label=data.label,
        max_marks=data.max_marks,
        text=data.text
    )
    db.add(q)
    db.commit()
    db.refresh(q)
    return q


@router.put("/questions/{question_id}/clos")
def map_clos(question_id: str, data: QuestionCLOMap, db: Session = Depends(get_db)):
    db.query(QuestionCLO).filter_by(question_id=question_id).delete()

    for clo_id in data.clo_ids:
        db.add(QuestionCLO(question_id=question_id, clo_id=clo_id))

    db.commit()
    return {"status": "CLOs mapped"}
