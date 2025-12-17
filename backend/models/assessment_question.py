# backend/models/assessment_question.py

import uuid
from sqlalchemy import Column, String, Integer, ForeignKey
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship
from core.db import Base


class AssessmentQuestion(Base):
    __tablename__ = "assessment_questions"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)

    assessment_id = Column(
        UUID(as_uuid=True),
        ForeignKey("assessments.id", ondelete="CASCADE"),
        nullable=False
    )

    question_text = Column(String, nullable=False)
    marks = Column(Integer, nullable=False)

    # ✅ FIXED relationship
    question_clos = relationship(
        "QuestionCLO",
        back_populates="question",
        cascade="all, delete-orphan"
    )
