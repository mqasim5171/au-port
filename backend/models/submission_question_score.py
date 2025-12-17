# backend/models/submission_question_score.py

import uuid
from sqlalchemy import Column, Integer, ForeignKey
from sqlalchemy.dialects.postgresql import UUID
from core.db import Base


class SubmissionQuestionScore(Base):
    __tablename__ = "submission_question_scores"

    # This table can use UUID PK (clean + consistent)
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)

    # StudentSubmission.id is String(36) in your project
    submission_id = Column(
        ForeignKey("student_submissions.id", ondelete="CASCADE"),
        nullable=False
    )

    # ✅ MUST MATCH assessment_questions.id type (UUID)
    question_id = Column(
        UUID(as_uuid=True),
        ForeignKey("assessment_questions.id", ondelete="CASCADE"),
        nullable=False
    )

    obtained_marks = Column(Integer, nullable=True)
