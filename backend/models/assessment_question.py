# backend/models/assessment_question.py

import uuid
from sqlalchemy import Column, Integer, ForeignKey, Text
from sqlalchemy.orm import relationship
from sqlalchemy.dialects.postgresql import UUID   # ✅ THIS IS THE RIGHT UUID
from core.db import Base


class AssessmentQuestion(Base):
    __tablename__ = "assessment_questions"

    id = Column(
        UUID(as_uuid=True),     # ✅ SQLAlchemy UUID
        primary_key=True,
        default=uuid.uuid4
    )

    assessment_id = Column(
        UUID(as_uuid=True),     # ✅ SQLAlchemy UUID
        ForeignKey("assessments.id", ondelete="CASCADE"),
        nullable=False
    )

    label = Column(Integer, nullable=False)  # or String if you prefer "Q1"
    max_marks = Column(Integer, nullable=False)
    text = Column(Text, nullable=True)

    clos = relationship(
        "QuestionCLO",
        back_populates="question",
        cascade="all, delete-orphan"
    )
