# models/student_submission.py
from sqlalchemy import Column, String, ForeignKey, DateTime
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

    submitted_at = Column(DateTime, default=datetime.utcnow)
