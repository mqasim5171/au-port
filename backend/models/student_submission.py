# models/student_submission.py
from sqlalchemy import Column, String, ForeignKey, DateTime, Integer
from datetime import datetime
from core.db import Base
import uuid
from sqlalchemy.dialects.postgresql import UUID


class StudentSubmission(Base):
    __tablename__ = "student_submissions"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    assessment_id = Column(
        UUID(as_uuid=True),
        ForeignKey("assessments.id"),
        nullable=False
    )

    student_id = Column(String(36), ForeignKey("users.id"), nullable=False)

    upload_id = Column(String(36), ForeignKey("uploads.id"), nullable=False)

    # ✅ total marks for the assessment (optional)
    obtained_marks = Column(Integer, nullable=True)

    submitted_at = Column(DateTime, default=datetime.utcnow)
