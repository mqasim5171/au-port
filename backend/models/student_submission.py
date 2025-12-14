# models/student_submission.py
import uuid
from datetime import datetime, timezone
from sqlalchemy.orm import Mapped, mapped_column, relationship
from sqlalchemy import String, Integer, DateTime, ForeignKey
from core.base import Base

def gen_id() -> str:
    return str(uuid.uuid4())

class StudentSubmission(Base):
    __tablename__ = "student_submissions"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=gen_id)
    assessment_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("assessments.id"), index=True
    )
    student_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("students.id"), index=True
    )

    file_upload_id: Mapped[str | None] = mapped_column(String(255), nullable=True)
    obtained_marks: Mapped[int | None] = mapped_column(Integer, nullable=True)
    grader_id: Mapped[str | None] = mapped_column(String(36), nullable=True)

    submitted_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(timezone.utc)
    )

    assessment = relationship("Assessment")
    student = relationship("Student")
