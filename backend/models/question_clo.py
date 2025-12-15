# backend/models/question_clo.py

import uuid
from sqlalchemy import Column, ForeignKey, Float
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship
from core.db import Base


class QuestionCLO(Base):
    __tablename__ = "question_clos"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)

    question_id = Column(
        UUID(as_uuid=True),
        ForeignKey("assessment_questions.id", ondelete="CASCADE")
    )

    clo_id = Column(
        UUID(as_uuid=True),
        ForeignKey("course_clos.id", ondelete="CASCADE")
    )

    weight_percent = Column(Float, nullable=True)

    question = relationship("AssessmentQuestion", back_populates="clos")
