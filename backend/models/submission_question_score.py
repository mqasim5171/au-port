# models/submission_question_score.py
from sqlalchemy import Column, String, Integer, ForeignKey
from core.db import Base
import uuid

class SubmissionQuestionScore(Base):
    __tablename__ = "submission_question_scores"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    submission_id = Column(String(36), ForeignKey("student_submissions.id"))
    question_id = Column(String(36), ForeignKey("assessment_questions.id"))
    obtained_marks = Column(Integer)
